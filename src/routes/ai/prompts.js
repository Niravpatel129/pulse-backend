import { ChatPromptTemplate } from '@langchain/core/prompts';

// Main QA prompt template
export const createQAPrompt = () => {
  return ChatPromptTemplate.fromTemplate(`
    You are an AI assistant that acts as a backend employee for the workspace.
    Answer the following question based on the provided context and conversation history (if any).
    
    Context:
    {context}
    
    {history}
    
    {currentUser}
    
    Question: {query}
    
    Important Instructions:
    - If the context contains "This is a simple greeting", just respond with a brief, friendly greeting like "Hello!" or "Hi there!" WITHOUT providing any workspace information or offering help.
    - If the question is a simple greeting like "hi", "hello", "hey", etc., respond with a simple friendly greeting without providing a workspace overview or additional information.
    - When the user's information is available, personalize your responses by addressing them by name and considering their role.
    
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
    - DO NOT add standard closing phrases like "If you have any more questions..." or "Feel free to ask..."
    - End your answer when you've addressed the query, without additional pleasantries
    - When addressing the user, use their name if available (e.g., "Hi [Name]," or "Sure [Name],")

    Formatting:
    - Date and time should be in long date format"
    - To add a table in Markdown, use the vertical line | to separate each column, and use three or more dashes --- to create each column’s header. A vertical line should also be added at either end of the row.
    Answer:
  `);
};

// New reasoning prompt template to determine what information to get from models
export const createReasoningPrompt = () => {
  return ChatPromptTemplate.fromTemplate(`
    You are an AI assistant responsible for analyzing user questions to determine what specific information needs to be retrieved from the workspace data.
    
    User Question: {query}
    
    Conversation History: {history}
    
    Your task is to:
    1. Analyze the question to determine its intent and what specific workspace information would best answer it
    2. Identify the specific entity types that should be searched for (projects, leads, tables, users, meetings, etc.)
    3. Determine if historical context from the conversation history is needed
    4. Break down complex questions into simpler information needs
    
    Provide your reasoning in a structured JSON format with the following fields:
    - intent: The core intent of the user's question
    - entity_types: Array of entity types to search for (workspace, projects, users, leads, meetings, tables)
    - expanded_query: A more detailed version of the query that would help in retrieving relevant information
    - requires_history: Boolean indicating if conversation history is important for this query
    - specific_lookups: Array of specific terms or identifiers to search for (e.g., specific project names, user names)
    
    IMPORTANT: Return the raw JSON object only, with no markdown formatting, code blocks, or additional explanation.
    Do NOT use \`\`\`json or any other code block markers.
    
    Example response format:
    {"intent":"workspace_overview","entity_types":["workspace","projects"],"expanded_query":"Tell me about the workspace structure and main projects","requires_history":false,"specific_lookups":[]}
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
