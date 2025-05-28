import { OpenAIEmbeddings } from '@langchain/openai';
import WorkspaceEmbedding from '../../models/WorkspaceEmbedding.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

// Initialize OpenAI embeddings
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

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
        const text = typeof doc === 'string' ? doc : JSON.stringify(doc);
        const embedding = await embeddings.embedQuery(text);

        // Extract metadata and title from the document
        const metadata = {
          type: 'workspace_data',
          ...(typeof doc === 'object' ? doc : {}),
        };

        // Generate a title if not provided
        let title = metadata.title;
        if (!title) {
          if (typeof doc === 'string') {
            // Use first 50 characters of text as title
            title = doc.slice(0, 50) + (doc.length > 50 ? '...' : '');
          } else if (doc.content) {
            title = doc.content.slice(0, 50) + (doc.content.length > 50 ? '...' : '');
          } else {
            title = `Embedding ${new Date().toISOString()}`;
          }
        }

        // Create new embedding document
        const embeddingDoc = new WorkspaceEmbedding({
          workspace: workspace._id,
          title,
          embedding,
          metadata,
          createdBy: userId,
        });

        // Only store text if explicitly requested
        if (storeText) {
          embeddingDoc.text = text;
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
