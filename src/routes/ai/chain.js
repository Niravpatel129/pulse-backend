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

// Create query result cache with 30 minute TTL - workspace-specific
const retrievalCache = new NodeCache({ stdTTL: 1800 });

// Cache for user data with 15 minute TTL
const userCache = new NodeCache({ stdTTL: 900 });

// New cache for reasoning results
const reasoningCache = new NodeCache({ stdTTL: 900 }); // 15 minutes

export function createQAChain(vectorStoreData) {
  console.log('Creating QA chain with vector store:', !!vectorStoreData);

  // Extract the main vector store from the data structure
  const vectorStore = vectorStoreData.main || vectorStoreData;

  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'gpt-4o', // Using a more capable model for better context understanding
    temperature: 0.1, // Slight increase in creativity for more natural responses
    maxConcurrency: 5, // Limit concurrent API calls
    cache: true, // Enable OpenAI's internal caching
    streaming: true, // Enable streaming for the model
  });

  // Create a lighter LLM for reasoning
  const reasoningLlm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'gpt-4o', // Can use the same model or a cheaper one like gpt-3.5-turbo
    temperature: 0.0, // Lower temperature for more deterministic reasoning
    maxConcurrency: 5,
    cache: true,
    streaming: false, // No streaming needed for reasoning
  });

  // Create a retriever wrapped in a function to handle errors
  const retriever = vectorStore.asRetriever({
    k: 8, // Increased from 5 to get more comprehensive context
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
      console.log(`Using cached user data for ${userId}`);
      return cachedUser;
    }

    try {
      // Ensure mongoose is connected
      if (mongoose.connection.readyState !== 1) {
        console.log('Mongoose not connected, skipping user lookup');
        return null;
      }

      // Fetch user data
      const user = await User.findById(userId).select('-password').lean();
      if (!user) {
        console.log(`User not found with ID: ${userId}`);
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
    if (!query) return null;

    // Check cache first
    const cacheKey = `reasoning_${workspaceId}_${query}`;
    const cachedReasoning = reasoningCache.get(cacheKey);
    if (cachedReasoning) {
      console.log(`Using cached reasoning for query: "${query}"`);
      return cachedReasoning;
    }

    // Handle simple greetings - skip reasoning step
    if (
      query
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

    try {
      console.log(`Applying reasoning to query: "${query}"`);
      const reasoningResult = await reasoningChain.invoke({
        query,
        history,
      });

      // Parse the JSON result
      let parsedResult;
      try {
        // Clean the result to handle potential markdown formatting
        const cleanedResult = reasoningResult
          .replace(/^```json\s*/, '') // Remove leading ```json
          .replace(/^```\s*/, '') // Remove leading ``` (without json)
          .replace(/\s*```$/, '') // Remove trailing ```
          .trim();

        console.log('Cleaned reasoning result:', cleanedResult);
        parsedResult = JSON.parse(cleanedResult);
        console.log(`Reasoning result:`, parsedResult);
      } catch (parseError) {
        console.error('Error parsing reasoning result:', parseError);
        // Fallback to standard query if we can't parse the result
        parsedResult = {
          intent: 'unknown',
          entity_types: detectEntityTypes(query),
          expanded_query: enhanceGeneralQueries(query),
          requires_history: history ? true : false,
          specific_lookups: [],
        };
      }

      // Cache the reasoning result
      reasoningCache.set(cacheKey, parsedResult);
      return parsedResult;
    } catch (error) {
      console.error('Error in reasoning chain:', error);
      // Fallback to standard query enhancement
      return {
        intent: 'unknown',
        entity_types: detectEntityTypes(query),
        expanded_query: enhanceGeneralQueries(query),
        requires_history: history ? true : false,
        specific_lookups: [],
      };
    }
  };

  // Wrap the retriever to handle potential errors and enhance queries by entity type
  const safeRetriever = async (query, workspaceId, history) => {
    if (!workspaceId) {
      console.error('No workspaceId provided for retrieval');
      return 'Error: No workspace context available.';
    }

    console.log(`Retrieving documents for query: "${query}" in workspace: ${workspaceId}`);

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
      console.log('Applied reasoning:', reasoning);

      // If it's a simple greeting, return immediately
      if (reasoning.expanded_query === 'SIMPLE_GREETING') {
        console.log('Detected simple greeting, skipping retrieval');
        return 'This is a simple greeting. Respond with a friendly hello without providing workspace information.';
      }

      // Check if we have cached results - use workspace-specific key
      const cacheKey = `retrieval_${workspaceId}_${q}`;
      const cachedResult = retrievalCache.get(cacheKey);
      if (cachedResult) {
        console.log('Using cached retrieval result for workspace:', workspaceId);
        return cachedResult;
      }

      // Use the entity types from reasoning instead of detecting them again
      const entityTypes =
        reasoning.entity_types || detectEntityTypes(reasoning.expanded_query || q);
      console.log('Entity types from reasoning:', entityTypes);

      // Use a parallel approach to fetch documents more efficiently
      const fetchPromises = [];

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
        const domainRetriever = domainVS ? domainVS.asRetriever({ k: 6 }) : retriever;

        fetchPromises.push(
          domainRetriever.getRelevantDocuments(`${entityType} ${expandedQuery}`).catch((err) => {
            console.error(`Error fetching ${entityType} documents:`, err);
            return [];
          }),
        );
      }

      // Wait for all fetches to complete
      const docSets = await Promise.all(fetchPromises);

      // Combine all documents
      let allDocs = [];
      for (const docSet of docSets) {
        allDocs = [...allDocs, ...docSet];
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

      // Convert to string format
      const docsString = formatDocumentsAsString(uniqueDocs);

      // Cache the result with workspace-specific key
      retrievalCache.set(cacheKey, docsString);

      return docsString;
    } catch (error) {
      console.error('Error in retriever:', error);
      return 'No relevant information found.';
    }
  };

  // Get the prompt from prompts.js
  const prompt = createQAPrompt();

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
