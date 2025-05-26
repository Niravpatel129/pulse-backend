import openai from '../config/openai.js';

export const countTokens = (messages) => {
  return messages.reduce((count, msg) => count + Math.ceil(msg.content.length / 4), 0);
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
