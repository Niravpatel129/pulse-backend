import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';

/**
 * Update a table's properties
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const updateTable = async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const { name, description, columns, aiPromptGuide } = req.body;
    const workspaceId = req.workspace._id;

    // Find the table and ensure it belongs to the current workspace
    const table = await Table.findOne({
      _id: tableId,
      workspace: workspaceId,
    });

    if (!table) {
      return next(new AppError('Table not found or you do not have access to this table', 404));
    }

    // Update table properties if provided
    if (name) {
      table.name = name;
    }

    if (description !== undefined) {
      table.description = description;
    }

    if (aiPromptGuide !== undefined) {
      table.aiPromptGuide = aiPromptGuide;
    }

    // Update columns if provided
    if (columns && Array.isArray(columns)) {
      // Validate columns structure
      for (const column of columns) {
        if (!column.id || !column.name) {
          return next(new AppError('Each column must have an id and name', 400));
        }
      }

      // Update existing columns
      for (const updatedColumn of columns) {
        const columnIndex = table.columns.findIndex((col) => col.id === updatedColumn.id);

        if (columnIndex !== -1) {
          // Update properties of existing column
          if (updatedColumn.name) {
            table.columns[columnIndex].name = updatedColumn.name;
          }
          if (updatedColumn.type) {
            table.columns[columnIndex].type = updatedColumn.type;
          }
          if (updatedColumn.order !== undefined) {
            table.columns[columnIndex].order = updatedColumn.order;
          }
          if (updatedColumn.options !== undefined) {
            table.columns[columnIndex].options = updatedColumn.options;
          }
        }
      }
    }

    await table.save();

    res.status(200).json({
      success: true,
      data: table,
      message: 'Table updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default updateTable;
