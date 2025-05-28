import dedent from 'dedent';

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

  getFullPrompt() {
    const fullPrompt = dedent`
      ${this.getSystemPrompt()}

    `;

    console.log('\n=== DEBUG: Full Prompt ===');
    console.log('Agent:', this.agent.name);
    console.log('Full Prompt:', fullPrompt);

    return fullPrompt;
  }
}

export default PromptManager;
