import Record from '../../models/Table/Record.js';
import Row from '../../models/Table/Row.js';
import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';

/**
 * Delete a row from a table
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const deleteTableRow = async (req, res, next) => {
  try {
    const { tableId, rowId } = req.params;
    const workspaceId = req.workspace._id;

    // Find the table and ensure it belongs to the current workspace
    const table = await Table.findOne({
      _id: tableId,
      workspace: workspaceId,
    });

    if (!table) {
      return next(new AppError('Table not found or you do not have access to this table', 404));
    }

    // Find the row to be deleted
    const row = await Row.findOne({
      _id: rowId,
      tableId,
    });

    if (!row) {
      return next(new AppError('Row not found in this table', 404));
    }

    // Delete all records associated with this row
    await Record.deleteMany({
      tableId,
      rowId,
    });

    // Delete the row
    await Row.findByIdAndDelete(rowId);

    // Update positions of remaining rows
    await Row.updateMany(
      {
        tableId,
        position: { $gt: row.position },
      },
      { $inc: { position: -1 } },
    );

    res.status(200).json({
      success: true,
      message: 'Row deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default deleteTableRow;
