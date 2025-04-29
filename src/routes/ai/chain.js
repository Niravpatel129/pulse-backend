import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import { formatDocumentsAsString } from 'langchain/util/document';
import { createQAPrompt, enhanceGeneralQueries } from './prompts.js';

export function createQAChain(vectorStore) {
  console.log('Creating QA chain with vector store:', !!vectorStore);

  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'gpt-4o', // Using a more capable model for better context understanding
    temperature: 0.1, // Slight increase in creativity for more natural responses
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

      // For general workspace queries, expand with specific related questions
      const enhancedQuery = enhanceGeneralQueries(q);
      console.log('Enhanced query:', enhancedQuery);

      // Detect entity types from the query to improve retrieval
      const entityTypes = detectEntityTypes(enhancedQuery);
      console.log('Detected entity types:', entityTypes);

      let allDocs = [];

      // First get workspace summary for context
      const summaryDocs = await retriever.getRelevantDocuments('workspace_summary');
      if (summaryDocs && summaryDocs.length > 0) {
        allDocs.push(summaryDocs[0]); // Add just the first summary doc
      }

      // Then get documents related to the specific query
      const specificDocs = await retriever.getRelevantDocuments(enhancedQuery);
      allDocs = [...allDocs, ...specificDocs];

      // If entity types were detected, get additional context for those entity types
      if (entityTypes.length > 0) {
        for (const entityType of entityTypes) {
          const entityDocs = await retriever.getRelevantDocuments(`${entityType} ${enhancedQuery}`);
          allDocs = [...allDocs, ...entityDocs];
        }
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
      return formatDocumentsAsString(uniqueDocs);
    } catch (error) {
      console.error('Error in retriever:', error);
      return 'No relevant information found.';
    }
  };

  // Get the prompt from prompts.js
  const prompt = createQAPrompt();

  // Simpler chain implementation that's more robust
  const chain = RunnableSequence.from([
    {
      // Map inputs to feed into prompt
      context: async (input) => {
        const query = input.query || '';
        return safeRetriever(query);
      },
      query: (input) => input.query || '',
    },
    prompt,
    llm,
    new StringOutputParser(),
  ]);

  console.log('Chain created with invoke method type:', typeof chain.invoke);
  return chain;
}

// Helper function to detect entity types in a query
function detectEntityTypes(query) {
  const entityTypes = [];
  const lowerQuery = query.toLowerCase();

  // Project-related keywords
  if (
    lowerQuery.includes('project') ||
    lowerQuery.includes('task') ||
    lowerQuery.includes('deadline') ||
    lowerQuery.includes('milestone')
  ) {
    entityTypes.push('project');
  }

  // User/Team member-related keywords
  if (
    lowerQuery.includes('user') ||
    lowerQuery.includes('team member') ||
    lowerQuery.includes('employee') ||
    lowerQuery.includes('staff')
  ) {
    entityTypes.push('user');
  }

  // Lead-related keywords
  if (
    lowerQuery.includes('lead') ||
    lowerQuery.includes('client') ||
    lowerQuery.includes('customer') ||
    lowerQuery.includes('prospect') ||
    lowerQuery.includes('form submission')
  ) {
    entityTypes.push('lead');
  }

  // Meeting-related keywords
  if (
    lowerQuery.includes('meeting') ||
    lowerQuery.includes('appointment') ||
    lowerQuery.includes('schedule') ||
    lowerQuery.includes('calendar')
  ) {
    entityTypes.push('meeting');
  }

  return entityTypes;
}
