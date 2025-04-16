import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';

/**
 * Update a specific column in a table
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const updateTableColumn = async (req, res, next) => {
  try {
    const { tableId, columnId } = req.params;
    const { column } = req.body;
    const workspaceId = req.workspace._id;

    // Find the table and ensure it belongs to the current workspace
    const table = await Table.findOne({
      _id: tableId,
      workspace: workspaceId,
    });

    if (!table) {
      return next(new AppError('Table not found or you do not have access to this table', 404));
    }

    // Find the column index
    const columnIndex = table.columns.findIndex((col) => col.id === columnId);

    if (columnIndex === -1) {
      return next(new AppError('Column not found in this table', 404));
    }

    // Create a copy of the column to modify
    const updatedColumn = { ...table.columns[columnIndex].toObject() };

    // Update the column properties
    if (column.name) {
      updatedColumn.name = column.name;
    }

    // Update icon if provided
    if (column.icon) {
      updatedColumn.icon = column.icon;
    }

    // Update type if provided (along with appropriate default options)
    if (column.type && column.type.id) {
      const newType = column.type.id;
      const oldType = updatedColumn.type;

      // Only proceed with type changes if the type is actually changing
      if (newType !== oldType) {
        updatedColumn.type = newType;

        // When changing column type, reset all options to prevent validation errors
        updatedColumn.options = {};

        // Set default options based on new type
        if (newType === 'currency') {
          updatedColumn.options.currencySymbol = '$';
          updatedColumn.options.hasDecimals = false;
          updatedColumn.options.decimalPlaces = 2;
        } else if (newType === 'single_select' || newType === 'multi_select') {
          updatedColumn.options.selectOptions = [];
          updatedColumn.options.showAsBadges = false;
        } else if (newType === 'date') {
          updatedColumn.options.dateFormat = 'MM/DD/YYYY';
        } else if (newType === 'phone') {
          updatedColumn.options.phoneFormat = 'international';
        } else if (newType === 'number') {
          updatedColumn.options.hasDecimals = false;
          updatedColumn.options.decimalPlaces = 2;
        } else if (newType === 'checkbox') {
          updatedColumn.options.defaultChecked = false;
        }
      }
    }

    // Update options if provided
    if (column.options) {
      // Get the column type (which might have just been updated)
      const columnType = updatedColumn.type;

      // Ensure options object exists
      if (!updatedColumn.options) {
        updatedColumn.options = {};
      }

      // Safely merge options based on column type
      if (columnType === 'single_select' || columnType === 'multi_select') {
        if (column.options.selectOptions) {
          updatedColumn.options.selectOptions = column.options.selectOptions;
        }
        if (column.options.showAsBadges !== undefined) {
          updatedColumn.options.showAsBadges = column.options.showAsBadges;
        }
      }

      if (columnType === 'number' || columnType === 'currency') {
        if (column.options.hasDecimals !== undefined) {
          updatedColumn.options.hasDecimals = column.options.hasDecimals;
        }
        if (column.options.decimalPlaces !== undefined) {
          updatedColumn.options.decimalPlaces = column.options.decimalPlaces;
        }
      }

      if (columnType === 'currency' && column.options.currencySymbol) {
        updatedColumn.options.currencySymbol = column.options.currencySymbol;
      }

      if (['number', 'percent', 'rating'].includes(columnType)) {
        if (column.options.minValue !== undefined) {
          updatedColumn.options.minValue = column.options.minValue;
        }
        if (column.options.maxValue !== undefined) {
          updatedColumn.options.maxValue = column.options.maxValue;
        }
      }

      if (columnType === 'date' && column.options.dateFormat) {
        updatedColumn.options.dateFormat = column.options.dateFormat;
      }

      if (columnType === 'checkbox' && column.options.defaultChecked !== undefined) {
        updatedColumn.options.defaultChecked = column.options.defaultChecked;
      }

      if (columnType === 'formula' && column.options.formula) {
        updatedColumn.options.formula = column.options.formula;
      }

      if (columnType === 'phone' && column.options.phoneFormat) {
        updatedColumn.options.phoneFormat = column.options.phoneFormat;
      }

      if (columnType === 'lookup') {
        if (column.options.referencedTable) {
          updatedColumn.options.referencedTable = column.options.referencedTable;
        }
        if (column.options.referencedColumn) {
          updatedColumn.options.referencedColumn = column.options.referencedColumn;
        }
      }

      // Add common options that apply to all column types
      if (column.options.headerAlignment) {
        updatedColumn.options.headerAlignment = column.options.headerAlignment;
      }

      if (column.options.cellAlignment) {
        updatedColumn.options.cellAlignment = column.options.cellAlignment;
      }

      if (column.options.minWidth !== undefined) {
        updatedColumn.options.minWidth = column.options.minWidth;
      }

      if (column.options.defaultWidth !== undefined) {
        updatedColumn.options.defaultWidth = column.options.defaultWidth;
      }

      if (column.options.defaultValue !== undefined) {
        updatedColumn.options.defaultValue = column.options.defaultValue;
      }
    }

    // Update specific option fields
    if (column.isRequired !== undefined) {
      updatedColumn.isRequired = column.isRequired;
    }

    if (column.isUnique !== undefined) {
      updatedColumn.isUnique = column.isUnique;
    }

    if (column.isHidden !== undefined) {
      updatedColumn.isHidden = column.isHidden;
    }

    if (column.description) {
      updatedColumn.description = column.description;
    }

    // Update AG Grid specific options
    if (column.allowSorting !== undefined) {
      updatedColumn.allowSorting = column.allowSorting;
    }

    if (column.allowFiltering !== undefined) {
      updatedColumn.allowFiltering = column.allowFiltering;
    }

    if (column.allowEditing !== undefined) {
      updatedColumn.allowEditing = column.allowEditing;
    }

    if (column.allowResizing !== undefined) {
      updatedColumn.allowResizing = column.allowResizing;
    }

    // Update order if provided
    if (column.order !== undefined) {
      updatedColumn.order = column.order;
    }

    // Replace the column with the updated version
    table.columns[columnIndex] = updatedColumn;

    await table.save();

    res.status(200).json({
      success: true,
      data: table,
      message: 'Column updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default updateTableColumn;
