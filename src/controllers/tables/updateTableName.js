import Table from '../../models/Table/Table.js';
import { clearRetrieverCache } from '../../routes/ai/chain.js';
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

    // Update the table properties
    table.name = name;

    // Update description if provided
    if (description !== undefined) {
      table.description = description;
    }

    // Update AI prompt guide if provided
    if (aiPromptGuide !== undefined) {
      table.aiPromptGuide = aiPromptGuide;

      // Clear the retriever cache for this workspace to refresh AI context
      clearRetrieverCache(workspaceId.toString());
    }

    await table.save();

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
