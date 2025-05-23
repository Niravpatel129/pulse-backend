import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import { formatDocumentsAsString } from 'langchain/util/document';
import mongoose from 'mongoose';
import NodeCache from 'node-cache';
import { createQAPrompt, createReasoningPrompt, enhanceGeneralQueries } from './prompts.js';
import { getDomainVectorStore } from './vectorStore.js';

// Import User model
import User from '../../models/User.js';
// Import ChatSettings model
import ChatSettings from '../../models/ChatSettings.js';

// Simple token estimation function
function estimateTokens(text) {
  if (!text) return 0;
  // Rough estimate: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

// Create query result cache with 30 minute TTL - workspace-specific
const retrievalCache = new NodeCache({ stdTTL: 1800 });

// Cache for user data with 15 minute TTL
const userCache = new NodeCache({ stdTTL: 900 });

// New cache for reasoning results
const reasoningCache = new NodeCache({ stdTTL: 900 }); // 15 minutes

// Cache for settings with 10 minute TTL
const settingsCache = new NodeCache({ stdTTL: 600 });

// Export the settingsCache
export { settingsCache };

export async function createQAChain(vectorStoreData, workspaceId) {
  // Extract the main vector store from the data structure
  const vectorStore = vectorStoreData.main || vectorStoreData;

  // Get workspace chat settings
  let modelName = 'gpt-4o'; // Default model
  let temperature = 0.1; // Default temperature
  let contextSettings = ''; // Default empty context settings

  if (workspaceId) {
    // Check cache first
    const cacheKey = `settings_${workspaceId}`;
    let settings = settingsCache.get(cacheKey);

    if (!settings) {
      try {
        settings = await ChatSettings.findOne({ workspace: workspaceId }).lean();
        if (settings) {
          // Cache the settings
          settingsCache.set(cacheKey, settings);
        }
      } catch (error) {
        console.error('Error fetching chat settings:', error);
      }
    }

    if (settings) {
      // Map the selected model to the actual OpenAI model name
      if (settings.selectedModel === 'gpt-4') {
        modelName = 'gpt-4o';
      } else if (settings.selectedModel === 'gpt-3.5') {
        modelName = 'gpt-3.5-turbo-0125';
      } else {
        // For now, just use gpt-4o for non-OpenAI models since we only have OpenAI
        modelName = 'gpt-4o';
      }

      // Adjust temperature based on selected style
      if (settings.selectedStyle === 'creative') {
        temperature = 0.7;
      } else if (settings.selectedStyle === 'technical') {
        temperature = 0.0;
      } else if (settings.selectedStyle === 'friendly') {
        temperature = 0.3;
      } else if (settings.selectedStyle === 'professional') {
        temperature = 0.1;
      } else {
        temperature = 0.1; // Default
      }

      // Get custom context settings if available
      if (settings.contextSettings) {
        contextSettings = settings.contextSettings;
      }
    }
  }

  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'gpt-4.1-2025-04-14',
    maxConcurrency: 5, // Limit concurrent API calls
    cache: true, // Enable OpenAI's internal caching
    streaming: true, // Enable streaming for the model
    maxTokens: 1000, // Limit output tokens for cost control (≈$0.15 for gpt-4o)
  });

  // Create a lighter LLM for reasoning
  const reasoningLlm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'gpt-3.5-turbo-0125', // Always use a cheaper model for reasoning
    maxConcurrency: 5,
    cache: true,
    streaming: false, // No streaming needed for reasoning
    maxTokens: 550, // Limit reasoning output tokens (less than $0.01)
  });

  // Create a retriever wrapped in a function to handle errors
  const retriever = vectorStore.asRetriever({
    k: 8, // Reduced from 8 to 4 to limit context size and token usage
  });

  // Helper function to get user data
  const getUserData = async (userId) => {
    if (!userId) {
      return null;
    }

    // Check cache first
    const cacheKey = `user_${userId}`;
    const cachedUser = userCache.get(cacheKey);
    if (cachedUser) {
      return cachedUser;
    }

    try {
      // Ensure mongoose is connected
      if (mongoose.connection.readyState !== 1) {
        return null;
      }

      // Fetch user data
      const user = await User.findById(userId).select('-password').lean();
      if (!user) {
        return null;
      }

      const userData = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        jobTitle: user.jobTitle || 'Not specified',
        createdAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown',
      };

      // Cache the user data
      userCache.set(cacheKey, userData);
      return userData;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  // New function to apply reasoning before retrieval
  const applyReasoning = async (query, workspaceId, history) => {
    // Ensure inputs are properly formatted
    const safeQuery = query || '';
    const safeHistory = history || '';

    // Return default reasoning if query is empty
    if (!safeQuery.trim()) {
      return {
        intent: 'unknown',
        entity_types: [],
        expanded_query: '',
        requires_history: false,
        specific_lookups: [],
      };
    }

    // Check cache first
    const cacheKey = `reasoning_${workspaceId}_${safeQuery}`;
    const cachedReasoning = reasoningCache.get(cacheKey);
    if (cachedReasoning) {
      return cachedReasoning;
    }

    // Handle simple greetings - skip reasoning step
    if (
      safeQuery
        .toLowerCase()
        .trim()
        .match(/^(hi|hello|hey|howdy|greetings)(\?|!|\.)?$/)
    ) {
      const simpleReasoning = {
        intent: 'greeting',
        entity_types: [],
        expanded_query: 'SIMPLE_GREETING',
        requires_history: false,
        specific_lookups: [],
      };
      reasoningCache.set(cacheKey, simpleReasoning);
      return simpleReasoning;
    }

    // Create and run the reasoning chain
    try {
      // Format inputs properly for the reasoning prompt
      const reasoningPrompt = createReasoningPrompt();
      const reasoningChain = RunnableSequence.from([
        {
          query: (input) => input.query || '',
          history: (input) => input.history || '',
        },
        reasoningPrompt,
        reasoningLlm,
        new StringOutputParser(),
      ]);

      const reasoningResult = await reasoningChain.invoke({
        query: safeQuery || '',
        history: safeHistory || '',
      });

      // Parse the JSON result
      try {
        // Clean the result to handle potential markdown formatting
        let cleanedResult = reasoningResult
          .replace(/^```json\s*/, '') // Remove leading ```json
          .replace(/^```\s*/, '') // Remove leading ``` (without json)
          .replace(/\s*```$/, '') // Remove trailing ```
          .trim();

        // Remove any additional text before or after the JSON if present
        const jsonStartIndex = cleanedResult.indexOf('{');
        const jsonEndIndex = cleanedResult.lastIndexOf('}');

        if (jsonStartIndex >= 0 && jsonEndIndex >= 0) {
          cleanedResult = cleanedResult.substring(jsonStartIndex, jsonEndIndex + 1);
        }

        let parsedResult;
        try {
          // First attempt to parse the JSON directly
          parsedResult = JSON.parse(cleanedResult);
        } catch (initialParseError) {
          // If that fails, try to handle common issues with LLM outputs
          // Replace single quotes with double quotes if they exist
          const doubleQuotedResult = cleanedResult.replace(/'/g, '"');

          // Try to parse with double quotes
          parsedResult = JSON.parse(doubleQuotedResult);
        }

        // Cache the reasoning result
        reasoningCache.set(cacheKey, parsedResult);
        return parsedResult;
      } catch (parseError) {
        console.error('Error parsing reasoning result:', parseError);
        // Fallback to standard query if we can't parse the result
        const fallbackResult = {
          intent: 'unknown',
          entity_types: detectEntityTypes(safeQuery),
          expanded_query: enhanceGeneralQueries(safeQuery),
          requires_history: safeHistory ? true : false,
          specific_lookups: [],
        };
        reasoningCache.set(cacheKey, fallbackResult);
        return fallbackResult;
      }
    } catch (error) {
      console.error('Error in reasoning chain:', error);
      // Fallback to standard query enhancement with better error reporting
      const entityTypes = detectEntityTypes(safeQuery);

      const fallbackReasoning = {
        intent: 'unknown',
        entity_types: entityTypes,
        expanded_query: enhanceGeneralQueries(safeQuery),
        requires_history: safeHistory ? true : false,
        specific_lookups: [],
      };

      // Cache the fallback reasoning result
      reasoningCache.set(cacheKey, fallbackReasoning);
      return fallbackReasoning;
    }
  };

  // Wrap the retriever to handle potential errors and enhance queries by entity type
  const safeRetriever = async (query, workspaceId, history) => {
    if (!workspaceId) {
      console.error('No workspaceId provided for retrieval');
      return 'Error: No workspace context available.';
    }

    try {
      // Make sure we're passing a string to the retriever
      const q =
        typeof query === 'string'
          ? query
          : query && query.query && typeof query.query === 'string'
          ? query.query
          : 'What tables are available?';

      // Apply reasoning to determine what to retrieve
      const reasoning = await applyReasoning(q, workspaceId, history);

      // If it's a simple greeting, return immediately
      if (reasoning.expanded_query === 'SIMPLE_GREETING') {
        return 'This is a simple greeting. Respond with a friendly hello without providing workspace information.';
      }

      // Check if we have cached results - use workspace-specific key
      const cacheKey = `retrieval_${workspaceId}_${q}`;
      const cachedResult = retrievalCache.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Use the entity types from reasoning instead of detecting them again
      const entityTypes =
        reasoning.entity_types || detectEntityTypes(reasoning.expanded_query || q);

      // Use a parallel approach to fetch documents more efficiently
      const fetchPromises = [];
      const tableSpecificGuides = [];

      // First get workspace summary for context
      fetchPromises.push(
        retriever.getRelevantDocuments('workspace_summary').catch((err) => {
          console.error('Error fetching workspace summary:', err);
          return [];
        }),
      );

      // Then get documents related to the specific query - use expanded query from reasoning if available
      const expandedQuery = reasoning.expanded_query || enhanceGeneralQueries(q);
      fetchPromises.push(
        retriever.getRelevantDocuments(expandedQuery).catch((err) => {
          console.error('Error fetching documents for query:', err);
          return [];
        }),
      );

      // Add specific lookup terms from reasoning if available
      if (reasoning.specific_lookups && reasoning.specific_lookups.length > 0) {
        for (const term of reasoning.specific_lookups) {
          fetchPromises.push(
            retriever.getRelevantDocuments(term).catch((err) => {
              console.error(`Error fetching documents for specific term ${term}:`, err);
              return [];
            }),
          );
        }
      }

      // If entity types were detected, get additional context for those entity types
      for (const entityType of entityTypes) {
        // Use domain-specific vector stores if available - with workspace isolation
        const domainVS = getDomainVectorStore(workspaceId, entityType);
        const domainRetriever = domainVS ? domainVS.asRetriever({ k: 3 }) : retriever;

        fetchPromises.push(
          domainRetriever.getRelevantDocuments(`${entityType} ${expandedQuery}`).catch((err) => {
            console.error(`Error fetching ${entityType} documents:`, err);
            return [];
          }),
        );
      }

      // Check specifically for table-related questions and add targeted queries for table guides
      if (entityTypes.includes('tables') || q.toLowerCase().includes('table')) {
        // Get tables domain vector store if available
        const tablesVS = getDomainVectorStore(workspaceId, 'tables');
        const tablesRetriever = tablesVS ? tablesVS.asRetriever({ k: 2 }) : retriever;

        // Add specific table name search if mentioned in query
        const tableNameMatch = q.match(/\b(table|tables)\s+(\w+)/i);
        if (tableNameMatch && tableNameMatch[2]) {
          const tableName = tableNameMatch[2];
          fetchPromises.push(
            tablesRetriever.getRelevantDocuments(`table ${tableName}`).catch((err) => {
              console.error(`Error fetching specific table: ${tableName}`, err);
              return [];
            }),
          );
        }
      }

      // Wait for all fetches to complete
      const docSets = await Promise.all(fetchPromises);

      // Combine all documents
      let allDocs = [];
      for (const docSet of docSets) {
        allDocs = [...allDocs, ...docSet];
      }

      // Check for tables with AI guides and collect them separately
      const tablesWithGuides = allDocs.filter(
        (doc) => doc.metadata?.type === 'table' && doc.metadata?.hasAiGuide === true,
      );

      if (tablesWithGuides.length > 0) {
        tableSpecificGuides.push(
          '\n## TABLE-SPECIFIC AI GUIDES ##\n' +
            tablesWithGuides
              .map((doc) => {
                const content = doc.pageContent;
                const guidePart = content.includes('AI Prompt Guide:')
                  ? content.split('AI Prompt Guide:')[1].split('Sample Records:')[0].trim()
                  : '';
                return `Guide for table ${doc.metadata.name}:\n${guidePart}`;
              })
              .join('\n\n'),
        );
      }

      // Remove duplicates by pageContent
      const uniqueDocs = [];
      const seenContent = new Set();
      for (const doc of allDocs) {
        // Create a shorter hash of the content to avoid memory issues with very large docs
        const contentHash = doc.pageContent.substring(0, 100);
        if (!seenContent.has(contentHash)) {
          seenContent.add(contentHash);
          uniqueDocs.push(doc);
        }
      }

      console.log(`Retrieved ${uniqueDocs.length} unique documents for workspace ${workspaceId}`);

      // Limit total tokens in context to control costs
      const maxContextTokens = 6000; // About $0.06 for GPT-4o input tokens
      let tokenCount = 0;
      let prunedDocs = [];

      // Sort docs by metadata.score if available to prioritize most relevant
      uniqueDocs.sort((a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0));

      // Take docs until we hit the token limit
      for (const doc of uniqueDocs) {
        const docTokens = estimateTokens(doc.pageContent);
        if (tokenCount + docTokens <= maxContextTokens) {
          prunedDocs.push(doc);
          tokenCount += docTokens;
        } else {
          // Stop once we exceed token limit
          break;
        }
      }

      console.log(`Using ${prunedDocs.length} docs with estimated ${tokenCount} tokens`);

      // Convert to string format
      let docsString = formatDocumentsAsString(prunedDocs);

      // Add table-specific guides if available (prioritize these)
      if (tableSpecificGuides.length > 0) {
        const guidesString = tableSpecificGuides.join('\n');
        const guideTokens = estimateTokens(guidesString);

        // Only add if we have room within reasonable token limits
        if (tokenCount + guideTokens <= maxContextTokens + 2000) {
          // Allow slight overflow for guides
          docsString += '\n' + guidesString;
          tokenCount += guideTokens;
        } else {
          // Add a note that guides were truncated
          docsString += '\n\n## NOTE: Some table guides were truncated to control costs ##';
        }
      }

      console.log(`Final context estimated at ${estimateTokens(docsString)} tokens`);
      // Cache the result with workspace-specific key
      retrievalCache.set(cacheKey, docsString);

      return docsString;
    } catch (error) {
      console.error('Error in retriever:', error);
      return 'No relevant information found.';
    }
  };

  // Get the appropriate style from settings if available
  let promptStyle = 'default';
  let customContext = '';

  if (workspaceId && settingsCache.has(`settings_${workspaceId}`)) {
    const settings = settingsCache.get(`settings_${workspaceId}`);
    if (settings) {
      if (settings.selectedStyle) {
        promptStyle = settings.selectedStyle;
      }

      // Get custom context settings if available
      if (settings.contextSettings) {
        customContext = settings.contextSettings;
      }
    }
  }
  const workspaceName = '';

  // Get the prompt from prompts.js with the selected style
  const prompt = createQAPrompt(promptStyle, customContext, workspaceName);

  // Create an optimized chain with better error handling
  const chain = RunnableSequence.from([
    {
      // Map inputs to feed into prompt with optimized context retrieval
      context: async (input) => {
        const query = input.query || '';
        const workspaceId = input.workspaceId;
        const userId = input.userId;
        const history = input.history || '';

        if (!workspaceId) {
          console.error('Missing workspaceId in chain input');
          return 'Error: No workspace context provided.';
        }

        let contextString = await safeRetriever(query, workspaceId, history);

        // Add user context if available
        if (userId) {
          const userData = await getUserData(userId);
          if (userData) {
            contextString += `\n\nCurrent User Information:\nName: ${userData.name}\nEmail: ${userData.email}\nRole: ${userData.role}\nJob Title: ${userData.jobTitle}`;
          }
        }

        return contextString;
      },
      currentPath: (input) => input.currentPath || '',
      query: (input) => input.query || '',
      history: (input) => input.history || '',
      workspace: (input) => `Workspace ID: ${input.workspaceId || 'Unknown'}`,
      currentUser: async (input) => {
        if (!input.userId) return '';

        const userData = await getUserData(input.userId);
        return userData ? `Current User: ${userData.name} (${userData.role})` : '';
      },
    },
    prompt,
    llm,
    new StringOutputParser(),
  ]);

  console.log('Chain created with invoke method type:', typeof chain.invoke);
  return chain;
}

// Helper function to detect entity types in a query with improved accuracy
function detectEntityTypes(query) {
  const entityTypes = [];
  const lowerQuery = query.toLowerCase();

  // Define keyword patterns for each domain
  const patterns = {
    workspace: ['workspace', 'organization', 'company', 'team structure', 'overview'],
    projects: ['project', 'task', 'deadline', 'milestone', 'deliverable', 'timeline'],
    users: ['user', 'team member', 'employee', 'staff', 'colleague', 'manager'],
    leads: ['lead', 'client', 'customer', 'prospect', 'form submission', 'inquiry'],
    meetings: ['meeting', 'appointment', 'schedule', 'calendar', 'session', 'discussion'],
    tables: ['table', 'database', 'schema', 'records', 'data structure', 'fields'],
  };

  // Check each domain's patterns
  for (const [domain, keywords] of Object.entries(patterns)) {
    if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
      entityTypes.push(domain);
    }
  }

  return entityTypes;
}

// Helper to clear cache when needed
export function clearRetrieverCache(workspaceId) {
  if (workspaceId) {
    // Clear cache for specific workspace
    const keys = retrievalCache.keys();
    for (const key of keys) {
      if (key.includes(`_${workspaceId}_`)) {
        retrievalCache.del(key);
      }
    }
    console.log(`Retriever cache cleared for workspace ${workspaceId}`);
  } else {
    // Clear all cache
    retrievalCache.flushAll();
    console.log('All retriever cache cleared');
  }

  // Also clear reasoning cache
  reasoningCache.flushAll();
  console.log('Reasoning cache cleared');

  return true;
}

// New function to clear user cache
export function clearUserCache(userId) {
  if (userId) {
    // Clear specific user
    userCache.del(`user_${userId}`);
    console.log(`User cache cleared for ${userId}`);
  } else {
    // Clear all user cache
    userCache.flushAll();
    console.log('All user cache cleared');
  }
  return true;
}

// Add function to clear settings cache and remove the chain for a workspace
export function clearWorkspaceChain(workspaceId) {
  if (!workspaceId) return false;

  // Clear settings cache
  settingsCache.del(`settings_${workspaceId}`);
  console.log(`Settings cache cleared for workspace ${workspaceId}`);

  // Import the qaChains map on demand to avoid circular dependencies
  try {
    // Using dynamic import to avoid circular dependency
    import('./aiRoutes.js')
      .then((module) => {
        if (module.qaChains && module.qaChains instanceof Map) {
          module.qaChains.delete(workspaceId);
          console.log(`QA chain removed for workspace ${workspaceId}`);
        }
      })
      .catch((err) => {
        console.error('Error importing aiRoutes:', err);
      });
  } catch (error) {
    console.error('Error clearing workspace chain:', error);
  }

  return true;
}
