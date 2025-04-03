import Record from '../../models/Table/Record.js';
import AppError from '../../utils/AppError.js';

/**
 * Get a specific record from a table by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getTableRecordById = async (req, res, next) => {
  try {
    const { tableId, recordId } = req.params;

    // Find the specific record
    const record = await Record.findOne({
      _id: recordId,
      tableId,
    }).populate('createdBy', 'name email');

    if (!record) {
      return next(new AppError('Record not found', 404));
    }

    res.status(200).json({
      success: true,
      data: record,
      message: 'Record retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default getTableRecordById;
