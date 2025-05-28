import openai from '../config/openai.js';

export const countTokens = (messages) => {
  // Check if messages is valid
  if (!messages || !Array.isArray(messages)) return 0;

  return messages.reduce((count, msg) => {
    // Check if message is valid
    if (!msg || typeof msg !== 'object') return count;

    // Handle tool calls
    if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
      return (
        count +
        msg.tool_calls.reduce((toolCount, tool) => {
          if (!tool || typeof tool !== 'object') return toolCount;
          if (tool.function?.arguments && typeof tool.function.arguments === 'string') {
            return toolCount + Math.ceil(tool.function.arguments.length / 4);
          }
          return toolCount;
        }, 0)
      );
    }

    // Handle null/undefined content
    if (msg.content === null || msg.content === undefined) return count;

    // Handle array content (for messages with images)
    if (Array.isArray(msg.content)) {
      return (
        count +
        msg.content.reduce((subCount, item) => {
          if (!item || typeof item !== 'object') return subCount;
          if (item.type === 'text' && typeof item.text === 'string') {
            return subCount + Math.ceil(item.text.length / 4);
          }
          return subCount;
        }, 0)
      );
    }

    // Handle string content
    if (typeof msg.content === 'string') {
      return count + Math.ceil(msg.content.length / 4);
    }

    // If content is not a string or array, try to stringify it
    try {
      const contentStr = String(msg.content);
      return count + Math.ceil(contentStr.length / 4);
    } catch (error) {
      console.warn('Failed to count tokens for message:', msg);
      return count;
    }
  }, 0);
};

export const summarizeMessages = async (messages) => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'Summarize the following conversation in a concise way that preserves key information and context.',
        },
        ...messages,
      ],
      temperature: 0.3,
      max_tokens: 150,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error summarizing messages:', error);
    return 'Previous conversation context';
  }
};

export const MAX_CONTEXT_TOKENS = 4000;
