import openai from '../config/openai.js';

/**
 * Business Intelligence Service
 * Analyzes business name and location to infer industry and relevant keywords
 */
export class BusinessIntelligenceService {
  /**
   * Infer industry and keywords from business name and location
   * @param {string} businessName - The business name
   * @param {string} location - The business location
   * @returns {Promise<{industry: string, keywords: string[]}>} Inferred industry and keywords
   */
  static async inferBusinessDetails(businessName, location) {
    try {
      console.log('🔍 Inferring business details for:', { businessName, location });

      const prompt = `Analyze this business and provide industry classification and SEO keywords:

Business Name: ${businessName}
Location: ${location}

Please provide:
1. Industry classification (choose the most specific category that applies)
2. Primary SEO keywords that customers would search for (5-7 keywords)

Consider:
- What services/products this business likely offers
- Local search patterns for this type of business
- Industry-specific terminology
- Geographic modifiers that make sense

Respond in JSON format:
{
  "industry": "specific industry category",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

Industry should be specific (e.g., "restaurant", "auto repair", "hair salon", "dental practice", "law firm", "real estate", "retail clothing", "fitness center", etc.)
Keywords should be relevant search terms customers would use to find this business locally.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a business intelligence analyst specializing in local business categorization and SEO keyword research. Provide accurate, specific classifications and relevant local search keywords.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content);

      // Validate and clean up the response
      const industry = result.industry?.toLowerCase() || 'general business';
      const keywords = Array.isArray(result.keywords)
        ? result.keywords.filter((k) => k && typeof k === 'string').slice(0, 7)
        : [];

      console.log('✅ Business details inferred:', { industry, keywords });

      return {
        industry,
        keywords,
      };
    } catch (error) {
      console.error('❌ Failed to infer business details:', error.message);

      // Return fallback values if OpenAI fails
      return {
        industry: 'general business',
        keywords: [businessName.toLowerCase(), 'local business', 'services'],
      };
    }
  }

  /**
   * Enhance existing keywords with AI-generated suggestions
   * @param {string} businessName - The business name
   * @param {string} location - The business location
   * @param {string} industry - The business industry
   * @param {string[]} existingKeywords - Current keywords
   * @returns {Promise<string[]>} Enhanced keyword list
   */
  static async enhanceKeywords(businessName, location, industry, existingKeywords = []) {
    try {
      console.log('🔍 Enhancing keywords for:', { businessName, industry, existingKeywords });

      const prompt = `Enhance and expand this keyword list for local SEO:

Business Name: ${businessName}
Location: ${location}
Industry: ${industry}
Current Keywords: ${existingKeywords.join(', ')}

Add 3-5 more relevant keywords that customers would use to find this business locally.
Focus on:
- Service/product specific terms
- Local search variations
- Industry-specific terms
- Problem-solving keywords

Respond with JSON format:
{
  "enhanced_keywords": ["existing and new keywords combined"]
}

Return all keywords (existing + new) in a single array, removing duplicates.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a local SEO expert. Provide keyword suggestions that real customers would use to find this type of business.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
      });

      const result = JSON.parse(response.choices[0].message.content);
      const enhancedKeywords = Array.isArray(result.enhanced_keywords)
        ? result.enhanced_keywords.filter((k) => k && typeof k === 'string').slice(0, 10)
        : existingKeywords;

      console.log('✅ Keywords enhanced:', { enhancedKeywords });

      return enhancedKeywords;
    } catch (error) {
      console.error('❌ Failed to enhance keywords:', error.message);
      return existingKeywords;
    }
  }
}
