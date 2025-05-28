import openai from '../config/openai.js';

/**
 * Summarize a conversation using GPT-4
 * @param {Array} messages - Array of conversation messages
 * @returns {Promise<string>} The summarized conversation
 */
export const summarizeMessages = async (messages) => {
  try {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return 'No conversation to summarize';
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
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

    return response.choices[0]?.message?.content || 'Failed to generate summary';
  } catch (error) {
    console.error('Error summarizing messages:', error);
    return 'Error generating conversation summary';
  }
};

// Maximum number of tokens allowed in the context
export const MAX_CONTEXT_TOKENS = 4000;
