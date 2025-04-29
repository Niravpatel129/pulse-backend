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

  const prompt = ChatPromptTemplate.fromTemplate(`
    You are an AI assistant that helps users understand their database workspace.
    Answer the following question based on the provided context.
    
    Context:
    {context}
    
    Question: {query}
    
    If the question is general (like "what's my workspace about?"), synthesize an informative answer about the workspace 
    by analyzing the tables, their relationships, and the kind of data they contain. Consider:
    - The purpose of the workspace based on table names and columns
    - The relationships between tables
    - The type of application this might be (CRM, e-commerce, etc.)
    
    If the information isn't explicitly stated, make reasonable inferences based on table and column names.
    Be confident and helpful in your answer, but don't make up information that isn't supported by the context.
    
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

// Helper function to enhance general queries
function enhanceGeneralQueries(query) {
  const generalQueries = [
    "what's my workspace about",
    'what is this workspace',
    'what does this database contain',
    'what is this database about',
    'what is this system for',
    "what's in this database",
    "what's in my workspace",
    'tell me about my workspace',
    'explain my workspace',
    'overview of my workspace',
  ];

  // Check if the query is general
  const isGeneralQuery = generalQueries.some((q) => query.toLowerCase().includes(q.toLowerCase()));

  if (isGeneralQuery) {
    // Return a more comprehensive query to get better context
    return `${query} AND what tables are available AND what relationships exist between tables AND what is the purpose of this database AND workspace_summary`;
  }

  return query;
}
