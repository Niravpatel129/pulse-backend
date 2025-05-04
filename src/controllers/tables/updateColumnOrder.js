import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';

/**
 * Update the order of columns in a table
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const updateColumnOrder = async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const { columnIds } = req.body;
    const workspaceId = req.workspace._id;

    if (!columnIds || !Array.isArray(columnIds)) {
      return next(new AppError('Array of column IDs is required', 400));
    }

    // Find the table and ensure it belongs to the current workspace
    const table = await Table.findOne({
      _id: tableId,
      workspace: workspaceId,
    });

    if (!table) {
      return next(new AppError('Table not found or you do not have access to this table', 404));
    }

    // Verify all column IDs exist in the table
    const columnMap = {};
    table.columns.forEach((column) => {
      columnMap[column.id] = column;
    });

    for (const columnId of columnIds) {
      if (!columnMap[columnId]) {
        return next(new AppError(`Column with ID ${columnId} not found in table`, 404));
      }
    }

    // Verify all table columns are accounted for
    if (columnIds.length !== table.columns.length) {
      return next(new AppError('Column ID list must contain all table columns', 400));
    }

    // Reorder columns based on the provided order
    const updatedColumns = columnIds.map((columnId, index) => {
      const column = columnMap[columnId];
      column.order = index;
      return column;
    });

    table.columns = updatedColumns;

    await table.save();

    res.status(200).json({
      success: true,
      data: table.columns,
      message: 'Column order updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default updateColumnOrder;
