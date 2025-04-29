import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import { formatDocumentsAsString } from 'langchain/util/document';
import { createQAPrompt, enhanceGeneralQueries } from './prompts.js';

export function createQAChain(vectorStore) {
  console.log('Creating QA chain with vector store:', !!vectorStore);

  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'gpt-3.5-turbo', // Using a more available model
    temperature: 0,
  });

  // Create a retriever wrapped in a function to handle errors
  const retriever = vectorStore.asRetriever({
    k: 5, // Increased from 3 to get more context
  });

  // Wrap the retriever to handle potential errors
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

      const docs = await retriever.getRelevantDocuments(enhancedQuery);
      console.log(`Retrieved ${docs.length} documents`);
      return formatDocumentsAsString(docs);
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
