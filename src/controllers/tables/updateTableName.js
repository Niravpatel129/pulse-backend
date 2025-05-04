import axios from 'axios';
import Table from '../../models/Table/Table.js';
import { clearRetrieverCache } from '../../routes/ai/chain.js';
import { closeVectorStore, initVectorStore } from '../../routes/ai/vectorStore.js';
import AppError from '../../utils/AppError.js';

/**
 * Update a table's name, description, and AI prompt guide
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const updateTableName = async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const { name, description, aiPromptGuide } = req.body;
    const workspaceId = req.workspace._id;

    if (!name) {
      return next(new AppError('Table name is required', 400));
    }

    // Find the table and ensure it belongs to the current workspace
    const table = await Table.findOne({
      _id: tableId,
      workspace: workspaceId,
    });

    if (!table) {
      return next(new AppError('Table not found or you do not have access to this table', 404));
    }

    // Keep track if AI guide was updated
    const aiGuideWasUpdated = aiPromptGuide !== undefined && aiPromptGuide !== table.aiPromptGuide;

    // Update the table properties
    table.name = name;

    // Update description if provided
    if (description !== undefined) {
      table.description = description;
    }

    // Update AI prompt guide if provided
    if (aiGuideWasUpdated) {
      table.aiPromptGuide = aiPromptGuide;
    }

    await table.save();

    // If the AI guide was updated, trigger vector store refresh
    if (aiGuideWasUpdated) {
      try {
        console.log(
          `AI Prompt Guide updated for table ${table.name}. Refreshing vector store for workspace ${workspaceId}`,
        );

        // Clear immediate caches
        clearRetrieverCache(workspaceId.toString());

        // Trigger a background refresh of the vector store
        const refreshVectorStore = async () => {
          try {
            // Close existing vector store to free up resources
            await closeVectorStore(workspaceId.toString());

            // Reinitialize the vector store to include the updated AI guide
            await initVectorStore(workspaceId.toString());

            console.log(`Vector store successfully refreshed for workspace ${workspaceId}`);
          } catch (refreshError) {
            console.error(`Error refreshing vector store: ${refreshError.message}`);
          }
        };

        // Execute refresh in the background
        refreshVectorStore();

        // Try to call the refresh endpoint if we're in production
        // This is a backup method that works if we're running distributed services
        if (process.env.NODE_ENV === 'production' && process.env.AI_REFRESH_TOKEN) {
          try {
            const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
            await axios.post(
              `${baseUrl}/api/ai/refresh`,
              { workspaceId: workspaceId.toString() },
              {
                headers: {
                  Authorization: `Bearer ${process.env.AI_REFRESH_TOKEN}`,
                  'Content-Type': 'application/json',
                },
              },
            );
          } catch (axiosError) {
            // Don't fail if this doesn't work, it's just a backup method
            console.error('Error calling refresh endpoint:', axiosError.message);
          }
        }
      } catch (refreshError) {
        // Don't fail the update if refresh has issues
        console.error(`Error during refresh process: ${refreshError.message}`);
      }
    }

    res.status(200).json({
      success: true,
      data: table,
      message: 'Table updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default updateTableName;
