import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';

/**
 * Delete a table
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const deleteTable = async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const workspaceId = req.workspace._id;

    // Find the table and ensure it belongs to the current workspace
    const table = await Table.findOne({
      _id: tableId,
      workspace: workspaceId,
    });

    if (!table) {
      return next(new AppError('Table not found or you do not have access to this table', 404));
    }

    // Delete the table
    await Table.findByIdAndDelete(tableId);

    res.status(200).json({
      success: true,
      message: 'Table deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default deleteTable;
