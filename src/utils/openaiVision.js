import openai from '../config/openai.js';

/**
 * Analyze an image using OpenAI Vision (GPT-4 Vision) given an image URL.
 * @param {string} imageUrl - The URL of the image to analyze.
 * @returns {Promise<string>} - The description or analysis of the image.
 */
export async function analyzeImageWithOpenAI(imageUrl) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image in detail for a business assistant.' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: 300,
  });
  console.log('🚀 response:', response);

  return response.choices[0].message.content;
}
