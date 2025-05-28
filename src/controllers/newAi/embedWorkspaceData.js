import { OpenAIEmbeddings } from '@langchain/openai';
import OpenAI from 'openai';
import WorkspaceEmbedding from '../../models/WorkspaceEmbedding.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

// Initialize OpenAI embeddings
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Initialize OpenAI for text generation
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Cleans and preprocesses text for embedding
 * @param {string} text - The text to clean
 * @returns {string} - The cleaned text
 */
const preprocessText = (text) => {
  if (!text) return '';

  return (
    text
      // Remove HTML tags
      .replace(/<[^>]*>/g, ' ')
      // Remove special characters and extra whitespace
      .replace(/[^\w\s.,!?-]/g, ' ')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Remove leading/trailing whitespace
      .trim()
      // Remove multiple newlines
      .replace(/\n+/g, '\n')
      // Remove multiple periods
      .replace(/\.+/g, '.')
      // Remove multiple commas
      .replace(/,+/g, ',')
      // Remove multiple dashes
      .replace(/-+/g, '-')
      // Remove multiple question marks
      .replace(/\?+/g, '?')
      // Remove multiple exclamation marks
      .replace(/!+/g, '!')
      // Remove multiple spaces after punctuation
      .replace(/([.,!?-])\s+/g, '$1 ')
      // Add space after punctuation if missing
      .replace(/([.,!?-])([^\s])/g, '$1 $2')
  );
};

/**
 * Truncates text to a maximum length while preserving sentence boundaries
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length of the text
 * @returns {string} - The truncated text
 */
const truncateText = (text, maxLength = 2000) => {
  if (!text || text.length <= maxLength) return text;

  // Find the last sentence boundary before maxLength
  const lastPeriod = text.lastIndexOf('.', maxLength);
  const lastQuestion = text.lastIndexOf('?', maxLength);
  const lastExclamation = text.lastIndexOf('!', maxLength);

  const lastBoundary = Math.max(lastPeriod, lastQuestion, lastExclamation);

  if (lastBoundary === -1) {
    // If no sentence boundary found, just cut at maxLength
    return text.slice(0, maxLength) + '...';
  }

  return text.slice(0, lastBoundary + 1) + '...';
};

/**
 * Formats structured data into a meaningful text representation
 * @param {Object} data - The structured data object
 * @returns {string} - Formatted text representation
 */
const formatStructuredData = (data) => {
  if (!data || typeof data !== 'object') return '';

  const parts = [];

  // Handle common product/style fields
  if (data.title) parts.push(`Title: ${data.title}`);
  if (data.styleName) parts.push(`Style: ${data.styleName}`);
  if (data.brandName) parts.push(`Brand: ${data.brandName}`);
  if (data.partNumber) parts.push(`Part Number: ${data.partNumber}`);
  if (data.baseCategory) parts.push(`Category: ${data.baseCategory}`);

  // Handle description with HTML content
  if (data.description) {
    const cleanDescription = preprocessText(data.description);
    parts.push(`Description: ${cleanDescription}`);
  }

  // Handle additional metadata
  const metadataFields = Object.entries(data)
    .filter(([key, value]) => {
      // Skip already processed fields and empty values
      return (
        !['title', 'styleName', 'brandName', 'partNumber', 'baseCategory', 'description'].includes(
          key,
        ) &&
        value !== null &&
        value !== undefined &&
        value !== '' &&
        typeof value !== 'object'
      );
    })
    .map(([key, value]) => {
      // Format the field name to be more readable
      const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
      return `${formattedKey}: ${value}`;
    });

  if (metadataFields.length > 0) {
    parts.push('Additional Information:');
    parts.push(...metadataFields);
  }

  return parts.join('\n');
};

export const embedWorkspaceData = async (req, res, next) => {
  try {
    const { data, storeText = false } = req.body;
    const workspace = req.workspace;
    const userId = req.user.userId;

    if (!data) {
      throw new ApiError(400, 'Data is required for embedding');
    }

    if (!workspace) {
      throw new ApiError(404, 'Workspace not found');
    }

    // Process the data and create embeddings
    const documents = Array.isArray(data) ? data : [data];

    const embeddedDocs = await Promise.all(
      documents.map(async (doc) => {
        // Handle both string and object data
        const rawText = typeof doc === 'string' ? doc : formatStructuredData(doc);

        // Clean and preprocess the text
        const cleanedText = preprocessText(rawText);

        // Truncate text if needed
        const truncatedText = truncateText(cleanedText);

        const embedding = await embeddings.embedQuery(truncatedText);

        // Extract metadata and title from the document
        const metadata = {
          type: 'workspace_data',
          ...(typeof doc === 'object' ? doc : {}),
        };

        // Generate a title if not provided
        let title = metadata.title;
        if (!title) {
          if (typeof doc === 'string') {
            // Use first 50 characters of cleaned text as title
            title = cleanedText.slice(0, 50) + (cleanedText.length > 50 ? '...' : '');
          } else if (doc.styleName && doc.brandName) {
            // For style data, create a meaningful title
            title = `${doc.brandName} - ${doc.styleName}`;
          } else if (doc.content) {
            title = cleanedText.slice(0, 50) + (cleanedText.length > 50 ? '...' : '');
          } else {
            title = `Embedding ${new Date().toISOString()}`;
          }
        }

        // Generate description using OpenAI
        let description = '';
        try {
          const prompt = `Generate a concise description (max 2 sentences) for the following content:\n\n${truncatedText}`;
          const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 100,
            temperature: 0.7,
          });
          description = completion.choices[0].message.content.trim();
        } catch (error) {
          console.error('Error generating description:', error);
          // Fallback description if API call fails
          description = `Content embedded on ${new Date().toLocaleDateString()}`;
        }

        // Create new embedding document
        const embeddingDoc = new WorkspaceEmbedding({
          workspace: workspace._id,
          title,
          description,
          embedding,
          metadata,
          createdBy: userId,
        });

        // Only store text if explicitly requested
        if (storeText) {
          embeddingDoc.text = truncatedText;
        }

        return embeddingDoc;
      }),
    );

    // Save all embeddings
    await WorkspaceEmbedding.insertMany(embeddedDocs);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { count: embeddedDocs.length },
          'Workspace data embedded successfully',
        ),
      );
  } catch (error) {
    next(error);
  }
};
