import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';

/**
 * Update a table column's name
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const updateColumnName = async (req, res, next) => {
  try {
    const { tableId, columnId } = req.params;
    const { name } = req.body;
    const workspaceId = req.workspace._id;

    if (!name) {
      return next(new AppError('Column name is required', 400));
    }

    // Find the table and ensure it belongs to the current workspace
    const table = await Table.findOne({
      _id: tableId,
      workspace: workspaceId,
    });

    if (!table) {
      return next(new AppError('Table not found or you do not have access to this table', 404));
    }

    // Find the column index
    const columnIndex = table.columns.findIndex((col) => col.id === columnId);

    if (columnIndex === -1) {
      return next(new AppError('Column not found in this table', 404));
    }

    // Update the column name
    table.columns[columnIndex].name = name;

    await table.save();

    res.status(200).json({
      success: true,
      data: table.columns[columnIndex],
      message: 'Column renamed successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default updateColumnName;
