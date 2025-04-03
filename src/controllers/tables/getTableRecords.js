import Record from '../../models/Table/Record.js';
import Row from '../../models/Table/Row.js';

/**
 * Get all records for a specific table
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getTableRecords = async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // First, get the rows for this table
    const rows = await Row.find({ tableId })
      .sort({ position: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get the row IDs for the current page
    const rowIds = rows.map((row) => row._id);

    // Get records for these rows
    const records = await Record.find({
      tableId,
      rowId: { $in: rowIds },
    }).populate('createdBy', 'name email');

    // Group records by row
    const recordsByRow = records.reduce((acc, record) => {
      if (!acc[record.rowId]) {
        acc[record.rowId] = [];
      }
      acc[record.rowId].push(record);
      return acc;
    }, {});

    // Combine rows with their records
    const result = rows.map((row) => ({
      rowId: row._id,
      position: row.position,
      records: recordsByRow[row._id] || [],
    }));

    // Get total count for pagination
    const total = await Row.countDocuments({ tableId });

    // Get the next available position
    const nextPosition = rows.length > 0 ? Math.max(...rows.map((r) => r.position)) + 1 : 1;

    res.status(200).json({
      success: true,
      data: result,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
      metadata: {
        nextPosition,
      },
      message: 'Records retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default getTableRecords;
