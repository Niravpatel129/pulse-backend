import { OpenAIEmbeddings } from '@langchain/openai';
import { MongoClient } from 'mongodb';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

// Initialize OpenAI embeddings
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

export const embedWorkspaceData = async (req, res, next) => {
  try {
    const { data } = req.body;
    const workspace = req.workspace;

    if (!data) {
      throw new ApiError(400, 'Data is required for embedding');
    }

    if (!workspace) {
      throw new ApiError(404, 'Workspace not found');
    }

    // Connect to MongoDB
    const mongoClient = new MongoClient(process.env.MONGO_URI);
    await mongoClient.connect();

    // Get the database and collection
    const db = mongoClient.db(process.env.DB_NAME);
    const collection = db.collection('embeddings');

    // Process the data and create embeddings
    const documents = Array.isArray(data) ? data : [data];

    const embeddedDocs = await Promise.all(
      documents.map(async (doc) => {
        const text = typeof doc === 'string' ? doc : JSON.stringify(doc);
        const embedding = await embeddings.embedQuery(text);

        return {
          text,
          embedding,
          workspaceId: workspace._id,
          metadata: {
            type: 'workspace_data',
            timestamp: new Date(),
            ...(typeof doc === 'object' ? doc : {}),
          },
        };
      }),
    );

    // Store the embeddings in MongoDB
    await collection.insertMany(embeddedDocs);

    // Close the MongoDB connection
    await mongoClient.close();

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
