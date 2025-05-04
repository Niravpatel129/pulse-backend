import { ChatPromptTemplate } from '@langchain/core/prompts';

// Get style-specific instructions to customize prompt style
function getStyleInstructions(style = 'default') {
  const styleInstructions = {
    default: 'Be helpful, direct, and informative.',
    professional:
      'Maintain a formal, business-like tone. Use precise language and industry terminology when appropriate. Avoid colloquialisms and casual phrasing.',
    friendly:
      'Use a warm, conversational tone. Be approachable and personable, as if speaking to a friend. Use light humor when appropriate.',
    technical:
      'Prioritize technical accuracy and detail. Provide specific technical explanations with precise terminology. Use a structured approach to explanations.',
    creative:
      'Use a more expressive and dynamic communication style. Incorporate analogies and metaphors to explain complex concepts when helpful.',
  };

  return styleInstructions[style] || styleInstructions.default;
}

// Main QA prompt template
export const createQAPrompt = (style = 'default', customContext = '') => {
  const styleInstruction = getStyleInstructions(style);

  // Prepare custom context section if available
  const customContextSection = customContext ? `\n# User-Provided Context\n${customContext}\n` : '';

  return ChatPromptTemplate.fromTemplate(`
    # Role
    You are an AI assistant that acts as a backend employee for the workspace.

    # Task
    Answer the following question based on the provided context and conversation history.
    
    # Context Information
    {context}
    ${customContextSection}
    {history}
    
    {currentUser}

    Current Path: {currentPath}
    
    # Question
    {query}
    
    # Communication Style
    ${styleInstruction}
    
    # Instructions
    1. If the context contains "This is a simple greeting" or the question is a simple greeting like "hi", "hello", "hey", etc., respond with a brief, friendly greeting without additional information.
    2. When the user's information is available, personalize responses by addressing them by name and considering their role.
    3. For general questions about the workspace, synthesize an informative answer by analyzing:
       - Workspace purpose based on tables, projects, and team structure
       - Projects: status, team members, clients
       - Leads and lead forms
       - Team members and roles
       - Upcoming meetings and deadlines
       - Relationships between workspace elements
       - Application type (CRM, project management, etc.)
    4. For specific questions about projects, leads, team members, or other elements, provide relevant details from the context.
    5. For follow-up questions, reference conversation history for continuity.
    6. Make reasonable inferences based on available data, but don't fabricate information.
    7. IMPORTANT: When answering questions about tables, ALWAYS prioritize information from TABLE-SPECIFIC AI GUIDES if available. These guides provide definitive rules and interpretations for how to work with each table.
    
    # Formatting Requirements
    - Be direct and concise
    - DO NOT add closing phrases like "If you have any more questions..." or "Feel free to ask..."
    - End your answer when you've addressed the query
    - Format dates in long date format
    - For tables, use proper Markdown formatting with vertical lines and dashes for headers
    
    # Answer
  `);
};

// New reasoning prompt template to determine what information to get from models
export const createReasoningPrompt = () => {
  return ChatPromptTemplate.fromTemplate(`
    # Role and Task
    You are an AI assistant analyzing user questions to determine what specific information needs to be retrieved from workspace data.
    
    # Input
    User Question: {query}
    Conversation History: {history}
    
    # Process
    1. Analyze the question intent and identify required workspace information
    2. Identify specific entity types to search for (projects, leads, tables, users, meetings, etc.)
    3. Determine if historical context is needed
    4. Break down complex questions into simpler information needs
    
    # Output Format
    Return a JSON object with these fields:
    - intent: Core intent of the user's question
    - entity_types: Array of entity types to search for (workspace, projects, users, leads, meetings, tables)
    - expanded_query: More detailed version of the query for retrieving relevant information
    - requires_history: Boolean indicating if conversation history is important
    - specific_lookups: Array of specific terms or identifiers to search for
    
    # Important
    Return ONLY the raw JSON object without markdown formatting, code blocks, or explanation.
    
    Example:
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
