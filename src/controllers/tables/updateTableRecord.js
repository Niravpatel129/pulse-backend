import Record from '../../models/Table/Record.js';
import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';

/**
 * Update a specific record in a table
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const updateTableRecord = async (req, res, next) => {
  try {
    const { tableId, recordId } = req.params;
    const { values } = req.body;
    const workspaceId = req.workspace._id;

    // Find the table and ensure it belongs to the current workspace
    const table = await Table.findOne({
      _id: tableId,
      workspace: workspaceId,
    });

    if (!table) {
      return next(new AppError('Table not found or you do not have access to this table', 404));
    }

    // Find and update the record
    const record = await Record.findOneAndUpdate(
      { _id: recordId, tableId },
      { values },
      { new: true, runValidators: true },
    ).populate('createdBy', 'name email');

    if (!record) {
      return next(new AppError('Record not found', 404));
    }

    res.status(200).json({
      success: true,
      data: record,
      message: 'Record updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default updateTableRecord;
