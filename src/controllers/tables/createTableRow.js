import Row from '../../models/Table/Row.js';
import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';

/**
 * Create a new row in a table
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const createTableRow = async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const { position } = req.body;
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

    // If position is provided, shift existing rows
    if (position) {
      await Row.updateMany(
        {
          tableId,
          position: { $gte: position },
        },
        { $inc: { position: 1 } },
      );
    } else {
      // If no position provided, add to the end
      const lastRow = await Row.findOne({ tableId }).sort({ position: -1 });
      position = lastRow ? lastRow.position + 1 : 1;
    }

    // Create the new row
    const row = await Row.create({
      tableId,
      position,
      createdBy: userId,
    });

    res.status(201).json({
      success: true,
      data: row,
      message: 'Row created successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default createTableRow;
