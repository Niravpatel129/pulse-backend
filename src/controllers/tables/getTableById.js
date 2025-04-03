import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';

/**
 * Get a single table by ID with all its data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getTableById = async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const workspaceId = req.workspace._id;

    // Find the table by ID and ensure it belongs to the current workspace
    const table = await Table.findOne({
      _id: tableId,
      workspace: workspaceId,
    });

    // If no table is found, return an error
    if (!table) {
      return next(new AppError('Table not found or you do not have access to this table', 404));
    }

    res.status(200).json({
      success: true,
      data: table,
      message: 'Table retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default getTableById;
