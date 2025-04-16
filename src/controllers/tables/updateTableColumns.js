import mongoose from 'mongoose';
import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';

/**
 * Add new columns to a specific table
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const updateTableColumns = async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const columnData = req.body;
    const workspaceId = req.workspace._id;

    // Find the table and ensure it belongs to the current workspace
    const table = await Table.findOne({
      _id: tableId,
      workspace: workspaceId,
    });

    if (!table) {
      return next(new AppError('Table not found or you do not have access to this table', 404));
    }

    // Transform the incoming column data to match our schema
    const newColumn = {
      id: new mongoose.Types.ObjectId().toString(),
      name: columnData.name,
      type: columnData.type.id, // Extract the type ID from the type object
      icon: columnData.type.iconName || 'text',
      order: columnData.order,
      isRequired: false,
      isUnique: false,
      isHidden: false,
      // Initialize appropriate options based on column type
      options: {},
    };

    // Add additional options based on column type
    if (['single_select', 'multi_select'].includes(columnData.type.id)) {
      newColumn.options.selectOptions = [];
    } else if (columnData.type.id === 'currency') {
      newColumn.options.currencySymbol = '$';
      newColumn.options.hasDecimals = true;
      newColumn.options.decimalPlaces = 2;
    } else if (columnData.type.id === 'number') {
      newColumn.options.hasDecimals = false;
    } else if (columnData.type.id === 'date') {
      newColumn.options.dateFormat = 'MM/DD/YYYY';
    } else if (columnData.type.id === 'phone') {
      newColumn.options.phoneFormat = 'international';
    } else if (columnData.type.id === 'checkbox') {
      newColumn.options.defaultChecked = false;
    } else if (columnData.type.id === 'rating') {
      newColumn.options.maxValue = '5';
    }

    // Add the new column to the table
    table.columns.push(newColumn);
    await table.save();

    res.status(200).json({
      success: true,
      data: table,
      message: 'New column added successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default updateTableColumns;
