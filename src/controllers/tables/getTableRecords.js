import Record from '../../models/Table/Record.js';

/**
 * Get all records for a specific table
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getTableRecords = async (req, res, next) => {
  try {
    const { tableId } = req.params;

    // Find all records for the given table
    const records = await Record.find({ tableId })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: records.length,
      data: records.reverse(),
      message: 'Records retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default getTableRecords;
