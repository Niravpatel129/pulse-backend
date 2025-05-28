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
const truncateText = (text, maxLength = 10000) => {
  if (!text || text.length <= maxLength) return text;

  console.log(`Truncating text from ${text.length} to max ${maxLength} characters`);

  // Find the last sentence boundary before maxLength
  const lastPeriod = text.lastIndexOf('.', maxLength);
  const lastQuestion = text.lastIndexOf('?', maxLength);
  const lastExclamation = text.lastIndexOf('!', maxLength);

  const lastBoundary = Math.max(lastPeriod, lastQuestion, lastExclamation);

  if (lastBoundary === -1) {
    // If no sentence boundary found, try to find a paragraph break
    const lastParagraph = text.lastIndexOf('\n\n', maxLength);
    if (lastParagraph !== -1) {
      console.log(`Truncating at paragraph break at position ${lastParagraph}`);
      return text.slice(0, lastParagraph) + '...';
    }

    // If no paragraph break, try to find a single newline
    const lastNewline = text.lastIndexOf('\n', maxLength);
    if (lastNewline !== -1) {
      console.log(`Truncating at newline at position ${lastNewline}`);
      return text.slice(0, lastNewline) + '...';
    }

    // If no natural break found, just cut at maxLength
    console.log(`No natural break found, truncating at position ${maxLength}`);
    return text.slice(0, maxLength) + '...';
  }

  console.log(`Truncating at sentence boundary at position ${lastBoundary}`);
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
    console.log('\n=== Embedding Request Debug ===');
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request files:', req.files ? Object.keys(req.files) : 'No files');
    console.log('Content-Type:', req.headers['content-type']);

    const { data, storeText = false } = req.body;

    console.log('\n=== Data Inspection ===');
    console.log('Data type:', typeof data);
    console.log('Is Array?', Array.isArray(data));

    // Parse JSON string if needed
    let parsedData = data;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
        console.log('Successfully parsed JSON string');
      } catch (e) {
        console.log('Data is not valid JSON, treating as plain text');
      }
    }

    // If data is an object with a text field that's a JSON string, parse it
    if (
      parsedData &&
      typeof parsedData === 'object' &&
      parsedData.text &&
      typeof parsedData.text === 'string'
    ) {
      try {
        const parsedText = JSON.parse(parsedData.text);
        if (Array.isArray(parsedText)) {
          console.log('Found JSON array in text field, will process as individual items');
          parsedData = parsedText;
        }
      } catch (e) {
        console.log('Text field is not valid JSON, processing as is');
      }
    }

    // Ensure we have an array to work with
    const documents = Array.isArray(parsedData) ? parsedData : [parsedData];

    console.log(`\nProcessing ${documents.length} documents for embedding`);
    if (Array.isArray(parsedData)) {
      console.log('First item type:', typeof documents[0]);
      console.log('First item keys:', documents[0] ? Object.keys(documents[0]) : 'No first item');
    }

    const workspace = req.workspace;
    const userId = req.user.userId;

    console.log(`\nStarting embedding process for workspace: ${workspace._id}`);
    console.log(`Input data type: ${Array.isArray(parsedData) ? 'Array' : 'Single Object'}`);
    console.log(`Store text option: ${storeText}`);

    if (!parsedData) {
      console.error('Error: No data provided in request body');
      throw new ApiError(400, 'Data is required for embedding');
    }

    if (!workspace) {
      console.error('Error: No workspace found');
      throw new ApiError(404, 'Workspace not found');
    }

    let totalTokens = 0;
    let totalCost = 0;
    let totalTextLength = 0;
    let processedCount = 0;
    let failedCount = 0;
    let totalRawTextLength = 0;
    let progress = 0;

    const embeddedDocs = await Promise.all(
      documents.map(async (doc, index) => {
        console.log(`\nProcessing document ${index + 1}/${documents.length}`);
        progress = Math.round(((index + 1) / documents.length) * 100);
        console.log(`Progress: ${progress}%`);

        // Handle both string and object data
        const rawText = typeof doc === 'string' ? doc : formatStructuredData(doc);
        totalRawTextLength += rawText.length;

        console.log(`Document ${index + 1} details:`);
        console.log(`- Raw text length: ${rawText.length} characters`);
        console.log(`- Number of lines: ${rawText.split('\n').length}`);
        console.log(`- First 100 characters: ${rawText.substring(0, 100)}...`);

        if (rawText.length === 0) {
          console.warn(`Warning: Document ${index + 1} has empty text after initial processing`);
        }

        // Clean and preprocess the text
        const cleanedText = preprocessText(rawText);
        console.log(`- Cleaned text length: ${cleanedText.length} characters`);
        console.log(`- Number of lines after cleaning: ${cleanedText.split('\n').length}`);

        if (cleanedText.length === 0) {
          console.warn(`Warning: Document ${index + 1} has empty text after cleaning`);
        }

        // Truncate text if needed
        const truncatedText = truncateText(cleanedText);
        console.log(`- Final text length after truncation: ${truncatedText.length} characters`);
        console.log(`- Number of lines after truncation: ${truncatedText.split('\n').length}`);

        if (truncatedText.length === 0) {
          console.warn(`Warning: Document ${index + 1} has empty text after truncation`);
        }

        try {
          console.log('Generating embedding...');
          const embedding = await embeddings.embedQuery(truncatedText);
          console.log('Embedding generated successfully');

          // Calculate tokens and cost (approximate)
          const estimatedTokens = Math.ceil(truncatedText.length / 4);
          const cost = (estimatedTokens / 1000) * 0.0001;

          totalTokens += estimatedTokens;
          totalCost += cost;
          totalTextLength += truncatedText.length;
          processedCount++;

          // Extract metadata and title from the document
          const metadata = {
            type: 'workspace_data',
            ...(typeof doc === 'object' ? doc : {}),
          };

          // Generate a title if not provided
          let title = metadata.title;
          if (!title) {
            if (typeof doc === 'string') {
              title = cleanedText.slice(0, 50) + (cleanedText.length > 50 ? '...' : '');
            } else if (doc.styleName && doc.brandName) {
              title = `${doc.brandName} - ${doc.styleName}`;
            } else if (doc.partNumber) {
              title = `Part Number: ${doc.partNumber}`;
            } else if (doc.content) {
              title = cleanedText.slice(0, 50) + (cleanedText.length > 50 ? '...' : '');
            } else {
              title = `Item ${index + 1} - ${new Date().toISOString()}`;
            }
          }

          console.log(`Generated title: ${title}`);

          // Generate description using OpenAI
          let description = '';
          try {
            console.log('Generating AI description...');
            console.log('Sending request to OpenAI...');
            const prompt = `Generate a concise description (max 2 sentences) for the following content:\n\n${truncatedText}`;
            const completion = await openai.chat.completions.create({
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 100,
              temperature: 0.7,
            });
            console.log('Received response from OpenAI');
            description = completion.choices[0].message.content.trim();
            console.log('AI description generated successfully');
          } catch (error) {
            console.error('Error generating description:', error);
            console.error('Error details:', {
              message: error.message,
              code: error.code,
              type: error.type,
              status: error.status,
            });
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

          if (storeText) {
            embeddingDoc.text = truncatedText;
          }

          return embeddingDoc;
        } catch (error) {
          console.error(`Failed to process document ${index + 1}:`, error);
          failedCount++;
          throw new ApiError(500, `Failed to create embedding: ${error.message}`);
        }
      }),
    );

    // Save all embeddings
    console.log('\nSaving embeddings to database...');
    await WorkspaceEmbedding.insertMany(embeddedDocs);
    console.log('Embeddings saved successfully');

    console.log(`\nEmbedding Process Summary:
    Total Documents Processed: ${documents.length}
    Successfully Processed: ${processedCount}
    Failed Documents: ${failedCount}
    Total Raw Text Length: ${totalRawTextLength} characters
    Total Processed Text Length: ${totalTextLength} characters
    Total Tokens: ${totalTokens}
    Estimated Cost: $${totalCost.toFixed(6)}
    Average Raw Text Length: ${Math.round(totalRawTextLength / processedCount)} characters
    Average Processed Text Length: ${Math.round(totalTextLength / processedCount)} characters
    Average Tokens per Document: ${Math.round(totalTokens / processedCount)}`);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          count: embeddedDocs.length,
          totalTokens,
          estimatedCost: totalCost.toFixed(6),
          processedCount,
          failedCount,
          totalRawTextLength,
          totalTextLength,
          averageRawTextLength: Math.round(totalRawTextLength / processedCount),
          averageTextLength: Math.round(totalTextLength / processedCount),
          averageTokensPerDocument: Math.round(totalTokens / processedCount),
          progress: 100, // Final progress is 100% when complete
        },
        'Workspace data embedded successfully',
      ),
    );
  } catch (error) {
    console.error('Embedding process failed:', error);
    next(error);
  }
};
