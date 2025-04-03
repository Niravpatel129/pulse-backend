import Table from '../../models/Table/Table.js';

/**
 * Get all tables in a workspace
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getTables = async (req, res, next) => {
  try {
    const { workspaceId } = req;

    // Query parameters for filtering
    const { status = 'active', search } = req.query;

    // Build query
    const query = {
      workspace: workspaceId,
      status,
    };

    // Add search functionality if provided
    if (search) {
      query.$text = { $search: search };
    }

    const tables = await Table.find(query)
      .select('name description views columns createdAt updatedAt')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: tables.length,
      data: tables,
      message: 'Tables retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default getTables;
