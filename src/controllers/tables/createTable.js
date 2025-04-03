import Table from '../../models/Table/Table.js';

/**
 * Create a new table in the workspace
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const createTable = async (req, res, next) => {
  try {
    const { name } = req.body;
    const workspaceId = req.workspace._id;
    const userId = req.user.userId;

    if (!name) {
      throw new ApiError(400, 'Table name is required');
    }

    const table = await Table.create({
      name,
      workspace: workspaceId,
      createdBy: userId,
    });

    res.status(201).json({
      success: true,
      data: table,
      message: 'Table created successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default createTable;
