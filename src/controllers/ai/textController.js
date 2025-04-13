import openai from '../../config/openai.js';
import AppError from '../../utils/AppError.js';

const getEnhancementPrompt = (text, enhanceType, customPrompt) => {
  const baseInstructions = `Rewrite the following text to be more ${enhanceType}. Maintain the original meaning and intent. Return only the rewritten text, no explanations or formatting.`;

  switch (enhanceType) {
    case 'professional':
      return `${baseInstructions} Use business-appropriate language and maintain a professional tone. Text: ${text}`;
    case 'casual':
      return `${baseInstructions} Use conversational language and a friendly tone. Text: ${text}`;
    case 'formal':
      return `${baseInstructions} Use sophisticated language and maintain a formal tone. Text: ${text}`;
    case 'custom':
      return customPrompt
        ? `Rewrite the following text according to these instructions: ${customPrompt}. Return only the rewritten text, no explanations or formatting. Text: ${text}`
        : `Rewrite the following text to be more polished and clear. Return only the rewritten text, no explanations or formatting. Text: ${text}`;
    default:
      return `Rewrite the following text to be more polished and clear. Return only the rewritten text, no explanations or formatting. Text: ${text}`;
  }
};

export const enhanceText = async (req, res, next) => {
  try {
    const { text, enhanceType, customPrompt } = req.body;

    if (!text) {
      return next(new AppError('Text is required', 400));
    }

    if (!enhanceType) {
      return next(new AppError('Enhancement type is required', 400));
    }

    const prompt = getEnhancementPrompt(text, enhanceType, customPrompt);

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'You are a text rewriting assistant. Your task is to rewrite text according to specific instructions. Always return only the rewritten text, with no additional formatting, explanations, or commentary.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent results
      max_tokens: 1000,
      top_p: 0.9,
      frequency_penalty: 0.2,
      presence_penalty: 0.2,
    });

    const enhancedText = completion.choices[0].message.content.trim();

    res.status(200).json({
      status: 'success',
      data: {
        enhancedText,
        originalText: text,
        enhanceType,
        customPrompt,
        metadata: {
          model: 'gpt-3.5-turbo',
          timestamp: new Date().toISOString(),
          tokens: completion.usage.total_tokens,
        },
      },
    });
  } catch (error) {
    console.error('OpenAI API Error:', error);
    next(new AppError('Error processing text enhancement', 500));
  }
};
