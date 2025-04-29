import { ChatPromptTemplate } from '@langchain/core/prompts';

// Main QA prompt template
export const createQAPrompt = () => {
  return ChatPromptTemplate.fromTemplate(`
    You are an AI assistant that acts as a backend employee for the workspace.
    Answer the following question based on the provided context and conversation history (if any).
    
    Context:
    {context}
    
    {history}
    
    Question: {query}
    
    Important Instructions:
    - If the context contains "This is a simple greeting", just respond with a brief, friendly greeting like "Hello!" or "Hi there!" WITHOUT providing any workspace information or offering help.
    - If the question is a simple greeting like "hi", "hello", "hey", etc., respond with a simple friendly greeting without providing a workspace overview or additional information.
    
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
    
    If the user asks a follow-up question, refer to the conversation history to maintain context continuity.
    
    If the information isn't explicitly stated, make reasonable inferences based on the available data.
    Be confident and helpful in your answer, but don't make up information that isn't supported by the context.
    
    Speak as if you are a helpful colleague who has access to the workspace data and can assist with understanding
    the workspace structure, projects, leads, and other important information.
    
    Important formatting instructions:
    - Be direct and concise in your responses
    - Do NOT add standard closing phrases like "If you have any more questions..." or "Feel free to ask..."
    - End your answer when you've addressed the query, without additional pleasantries

    Formating:
    - Date and time should be in long date format"
    - Bold text should be in the format of **text**
    - Italics should be in the format of *text*
    - Code should be in the format of \`text\`
    - Links should be in the format of [text](link)
    - Lists should be in the format of - text
    - Numbered lists should be in the format of 1. text
    

    
    Answer:
  `);
};

// Helper function to enhance general queries
export function enhanceGeneralQueries(query) {
  // Check for simple greetings
  const simpleGreetings = [
    'hi',
    'hello',
    'hey',
    'howdy',
    'greetings',
    'hi there',
    'hello there',
    'good morning',
    'good afternoon',
    'good evening',
    'hiya',
    "what's up",
  ];

  if (
    simpleGreetings.some(
      (greeting) =>
        query.toLowerCase().trim() === greeting.toLowerCase() ||
        query.toLowerCase().trim() === greeting.toLowerCase() + '!' ||
        query.toLowerCase().trim() === greeting.toLowerCase() + '.' ||
        query.toLowerCase().trim() === greeting.toLowerCase() + '?',
    )
  ) {
    // Return a special marker for greetings
    return 'SIMPLE_GREETING';
  }

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
