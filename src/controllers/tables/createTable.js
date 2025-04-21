import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';

/**
 * Create a new table in the workspace with an initial row
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
      throw new AppError('Table name is required', 400);
    }

    // // Create the table
    const table = await Table.create({
      name,
      workspace: workspaceId,
      createdBy: userId,
    });

    // // Create an initial row for the table
    // const initialRow = await Row.create({
    //   tableId: table._id,
    //   position: 1,
    //   createdBy: userId,
    // });

    // Add the row to the response
    // const tableWithRow = {
    //   ...table.toObject(),
    //   initialRow,
    // };

    res.status(201).json({
      success: true,
      data: table.toObject(),
      message: 'Table created successfully with initial row',
    });
  } catch (error) {
    next(error);
  }
};

export default createTable;
