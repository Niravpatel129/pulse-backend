import { ChatPromptTemplate } from '@langchain/core/prompts';

// Main QA prompt template
export const createQAPrompt = () => {
  return ChatPromptTemplate.fromTemplate(`
    You are an AI assistant that acts as a backend employee for the workspace.
    Answer the following question based on the provided context.
    
    Context:
    {context}
    
    Question: {query}
    
    If the question is general (like "what's my workspace about?"), synthesize an informative answer about the workspace 
    by analyzing all available information, including:
    - The purpose of the workspace based on tables, projects, and team structure
    - Projects, their statuses, team members, and clients
    - Leads and lead forms in the workspace
    - Team members and their roles
    - Upcoming meetings and important deadlines
    - The relationships between tables, projects, and workspace elements
    - The type of application this might be (CRM, project management, etc.)
    
    If asked about specific projects, leads, team members, or other workspace elements, provide details from the context.
    
    If the information isn't explicitly stated, make reasonable inferences based on the available data.
    Be confident and helpful in your answer, but don't make up information that isn't supported by the context.
    
    Speak as if you are a helpful colleague who has access to the workspace data and can assist with understanding
    the workspace structure, projects, leads, and other important information.
    
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
    'show me my projects',
    'what leads do we have',
    'who is on my team',
    'upcoming meetings',
    'project status',
    'team overview',
  ];

  // Check if the query is general
  const isGeneralQuery = generalQueries.some((q) => query.toLowerCase().includes(q.toLowerCase()));

  if (isGeneralQuery) {
    // Return a more comprehensive query to get better context
    return `${query} AND what tables are available AND what projects exist AND what team members are in the workspace AND what leads are available AND upcoming meetings AND project deadlines AND workspace_summary`;
  }

  return query;
}
