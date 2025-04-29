import { ChatPromptTemplate } from '@langchain/core/prompts';

// Main QA prompt template
export const createQAPrompt = () => {
  return ChatPromptTemplate.fromTemplate(`
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
};

// Helper function to enhance general queries
export function enhanceGeneralQueries(query) {
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
