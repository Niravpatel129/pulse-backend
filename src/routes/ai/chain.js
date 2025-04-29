import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import { formatDocumentsAsString } from 'langchain/util/document';
import mongoose from 'mongoose';
import NodeCache from 'node-cache';
import { createQAPrompt, enhanceGeneralQueries } from './prompts.js';
import { getDomainVectorStore } from './vectorStore.js';

// Import User model
import User from '../../models/User.js';

// Create query result cache with 30 minute TTL - workspace-specific
const retrievalCache = new NodeCache({ stdTTL: 1800 });

// Cache for user data with 15 minute TTL
const userCache = new NodeCache({ stdTTL: 900 });

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

  // Wrap the retriever to handle potential errors and enhance queries by entity type
  const safeRetriever = async (query, workspaceId) => {
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

      // For general workspace queries, expand with specific related questions
      const enhancedQuery = enhanceGeneralQueries(q);
      console.log('Enhanced query:', enhancedQuery);

      // Special case for greetings
      if (enhancedQuery === 'SIMPLE_GREETING') {
        console.log('Detected simple greeting, skipping retrieval');
        return 'This is a simple greeting. Respond with a friendly hello without providing workspace information.';
      }

      // Check if we have cached results - use workspace-specific cache key
      const cacheKey = `retrieval_${workspaceId}_${q}`;
      const cachedResult = retrievalCache.get(cacheKey);
      if (cachedResult) {
        console.log('Using cached retrieval result for workspace:', workspaceId);
        return cachedResult;
      }

      // Detect entity types from the query to improve retrieval
      const entityTypes = detectEntityTypes(enhancedQuery);
      console.log('Detected entity types:', entityTypes);

      // Use a parallel approach to fetch documents more efficiently
      const fetchPromises = [];

      // First get workspace summary for context
      fetchPromises.push(
        retriever.getRelevantDocuments('workspace_summary').catch((err) => {
          console.error('Error fetching workspace summary:', err);
          return [];
        }),
      );

      // Then get documents related to the specific query
      fetchPromises.push(
        retriever.getRelevantDocuments(enhancedQuery).catch((err) => {
          console.error('Error fetching documents for query:', err);
          return [];
        }),
      );

      // If entity types were detected, get additional context for those entity types
      for (const entityType of entityTypes) {
        // Use domain-specific vector stores if available - with workspace isolation
        const domainVS = getDomainVectorStore(workspaceId, entityType);
        const domainRetriever = domainVS ? domainVS.asRetriever({ k: 6 }) : retriever;

        fetchPromises.push(
          domainRetriever.getRelevantDocuments(`${entityType} ${enhancedQuery}`).catch((err) => {
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

        if (!workspaceId) {
          console.error('Missing workspaceId in chain input');
          return 'Error: No workspace context provided.';
        }

        let contextString = await safeRetriever(query, workspaceId);

        // Add user context if available
        if (userId) {
          const userData = await getUserData(userId);
          if (userData) {
            contextString += `\n\nCurrent User Information:\nName: ${userData.name}\nEmail: ${userData.email}\nRole: ${userData.role}\nJob Title: ${userData.jobTitle}`;
          }
        }

        return contextString;
      },
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
