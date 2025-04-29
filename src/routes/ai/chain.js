import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import { formatDocumentsAsString } from 'langchain/util/document';
import NodeCache from 'node-cache';
import { createQAPrompt, enhanceGeneralQueries } from './prompts.js';
import { getDomainVectorStore } from './vectorStore.js';

// Create query result cache with 30 minute TTL
const retrievalCache = new NodeCache({ stdTTL: 1800 });

export function createQAChain(vectorStore) {
  console.log('Creating QA chain with vector store:', !!vectorStore);

  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'gpt-4o', // Using a more capable model for better context understanding
    temperature: 0.1, // Slight increase in creativity for more natural responses
    maxConcurrency: 5, // Limit concurrent API calls
    cache: true, // Enable OpenAI's internal caching
  });

  // Create a retriever wrapped in a function to handle errors
  const retriever = vectorStore.asRetriever({
    k: 8, // Increased from 5 to get more comprehensive context
  });

  // Wrap the retriever to handle potential errors and enhance queries by entity type
  const safeRetriever = async (query) => {
    console.log('Retrieving documents for query:', query);

    try {
      // Make sure we're passing a string to the retriever
      const q =
        typeof query === 'string'
          ? query
          : query && query.query && typeof query.query === 'string'
          ? query.query
          : 'What tables are available?';

      // Check if we have cached results
      const cacheKey = `retrieval_${q}`;
      const cachedResult = retrievalCache.get(cacheKey);
      if (cachedResult) {
        console.log('Using cached retrieval result');
        return cachedResult;
      }

      // For general workspace queries, expand with specific related questions
      const enhancedQuery = enhanceGeneralQueries(q);
      console.log('Enhanced query:', enhancedQuery);

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
        // Use domain-specific vector stores if available
        const domainVS = getDomainVectorStore(entityType);
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

      console.log(`Retrieved ${uniqueDocs.length} unique documents`);

      // Convert to string format
      const docsString = formatDocumentsAsString(uniqueDocs);

      // Cache the result
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
        return safeRetriever(query);
      },
      query: (input) => input.query || '',
      history: (input) => input.history || '',
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
export function clearRetrieverCache() {
  retrievalCache.flushAll();
  console.log('Retriever cache cleared');
  return true;
}
