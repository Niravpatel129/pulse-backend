import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import { formatDocumentsAsString } from 'langchain/util/document';

export function createQAChain(vectorStore) {
  console.log('Creating QA chain with vector store:', !!vectorStore);

  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'gpt-3.5-turbo', // Using a more available model
    temperature: 0,
  });

  // Create a retriever wrapped in a function to handle errors
  const retriever = vectorStore.asRetriever({
    k: 3,
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

      const docs = await retriever.getRelevantDocuments(q);
      console.log(`Retrieved ${docs.length} documents`);
      return formatDocumentsAsString(docs);
    } catch (error) {
      console.error('Error in retriever:', error);
      return 'No relevant information found.';
    }
  };

  const prompt = ChatPromptTemplate.fromTemplate(`
    Answer the following question based only on the provided context:
    
    Context:
    {context}
    
    Question: {query}
    
    Answer:
  `);

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
