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

    return fullSystemPrompt;
  }

  getConversationContext() {
    return `You are participating in a conversation with other AI agents. 
      Current turn: ${this.currentTurn + 1} of ${this.maxTurns}
      ${
        this.currentTurn === 0
          ? 'This is the initial user message.'
          : 'Other agents have responded to the conversation.'
      }
      ${
        this.currentTurn > 0
          ? 'Consider the previous responses and decide if you want to add to the conversation.'
          : ''
      }
  
      IMPORTANT: 
      1. If you don't have anything new or meaningful to add, respond with "NO_RESPONSE_NEEDED"
      2. For natural turn-based conversations (like telling jokes), just respond naturally without special prefixes
      3. Only use special prefixes in these specific cases:
         - Use "AGENT_QUERY:" when you need specific information from another agent
         - Use "AGENT_COLLABORATE:" when you need to work together on a complex task
      4. Your response should be unique and add value to the conversation
      5. Keep your responses concise and focused
      6. If you have completed your initial task, respond with "TASK_COMPLETE" instead of continuing the conversation
      7. You are limited to ${
        this.maxTurns
      } turns total. When approaching this limit, you should wrap up the conversation gracefully
      9. Always acknowledge the other agent's response before providing your own
      10. Track the turn count - you are on turn ${this.currentTurn + 1} of ${this.maxTurns}`;
  }

  getFullPrompt() {
    return `${this.getSystemPrompt()}\n\n${this.getConversationContext()}`;
  }
}

export default PromptManager;
