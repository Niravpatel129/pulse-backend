class PromptManager {
  constructor(agent, currentTurn, maxTurns) {
    this.agent = agent;
    this.currentTurn = currentTurn;
    this.maxTurns = maxTurns;
  }

  getSystemPrompt() {
    const systemPromptSection = this.agent.sections.find((s) => s.type === 'system_prompt');
    const instructionsSection = this.agent.sections.find((s) => s.type === 'instructions');
    const outputStructureSection = this.agent.sections.find((s) => s.type === 'output_structure');
    const examplesSection = this.agent.sections.find((s) => s.type === 'examples');
    const toolsSection = this.agent.sections.find((s) => s.type === 'tools');

    let fullSystemPrompt =
      systemPromptSection?.content ||
      'You are a helpful AI assistant. Keep responses concise and relevant.';

    if (instructionsSection?.content) {
      fullSystemPrompt += `\n\nInstructions:\n${instructionsSection.content}`;
    }

    if (outputStructureSection?.content) {
      fullSystemPrompt += `\n\nExpected Output Structure:\n${outputStructureSection.content}`;
    }

    if (examplesSection?.examples) {
      fullSystemPrompt += `\n\nExamples:\n${examplesSection.examples}`;
    }

    if (toolsSection?.tools?.length > 0) {
      fullSystemPrompt += `\n\nAvailable Tools:\n${toolsSection.tools
        .map((tool) => `- ${tool.name} (${tool.id})`)
        .join('\n')}`;
    }

    console.log('\n=== DEBUG: System Prompt ===');
    console.log('Agent:', this.agent.name);
    console.log('System Prompt:', fullSystemPrompt);

    return fullSystemPrompt;
  }

  getConversationContext() {
    return `You are participating in a conversation with other AI agents. 
      Current turn: ${this.currentTurn + 1} of ${this.maxTurns}
  
      IMPORTANT: 
      1. Each agent should provide exactly ONE response and then stop
      2. If you don't have anything meaningful to add, respond with "NO_RESPONSE_NEEDED"
      3. For natural turn-based conversations, just respond naturally without special prefixes
      4. Only use special prefixes in these specific cases:
         - Use "AGENT_QUERY:" when you need specific information from another agent
         - Use "AGENT_COLLABORATE:" when you need to work together on a complex task
      5. Your response should be unique and add value to the conversation
      6. Keep your responses concise and focused
      7. Always acknowledge the other agent's response before providing your own
      8. After providing your single response, do not continue the conversation
      9. Track the turn count - you are on turn ${this.currentTurn + 1} of ${this.maxTurns}
      10. For joke-telling scenarios:
          - Tell exactly ONE joke
          - Do not add commentary or ask questions
          - Do not try to continue the conversation
          - After telling your joke, the conversation will automatically move to the next agent
          - Maintain awareness of the conversation context and previous jokes
          - Do not repeat jokes that have already been told`;
  }

  getFullPrompt() {
    const fullPrompt = `${this.getSystemPrompt()}\n\n${this.getConversationContext()}`;

    console.log('\n=== DEBUG: Full Prompt ===');
    console.log('Agent:', this.agent.name);
    console.log('Full Prompt:', fullPrompt);

    return fullPrompt;
  }
}

export default PromptManager;
