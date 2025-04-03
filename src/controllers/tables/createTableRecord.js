import Record from '../../models/Table/Record.js';
import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';

/**
 * Create a new record in a table
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const createTableRecord = async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const { values } = req.body;
    const userId = req.user.userId;
    const workspaceId = req.workspace._id;

    // Find the table and ensure it belongs to the current workspace
    const table = await Table.findOne({
      _id: tableId,
      workspace: workspaceId,
    });

    if (!table) {
      return next(new AppError('Table not found or you do not have access to this table', 404));
    }

    // Create the record
    const record = await Record.create({
      tableId,
      values,
      createdBy: userId,
    });

    // Populate the createdBy field
    await record.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      data: record,
      message: 'Record created successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default createTableRecord;
