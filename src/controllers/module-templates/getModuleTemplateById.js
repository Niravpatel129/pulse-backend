import ModuleTemplate from '../../models/ModuleTemplate.js';
import Record from '../../models/Table/Record.js';
import Row from '../../models/Table/Row.js';
import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';

/**
 * Get a module template by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getModuleTemplateById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace._id;

    // Find the module template
    const moduleTemplate = await ModuleTemplate.findOne({
      _id: id,
      workspace: workspaceId,
    }).populate({
      path: 'fields.relationType',
      select: 'name',
    });

    if (!moduleTemplate) {
      return next(new AppError('Module template not found', 404));
    }

    // Convert module template to plain object
    const moduleTemplateObj = moduleTemplate.toObject();

    // Process each field
    const processedFields = await Promise.all(
      moduleTemplateObj.fields.map(async (field) => {
        // Create a base field object with common properties
        const processedField = {
          ...field,
          description: field.description || '',
          options: field.options || [],
        };

        // If it's a relation field, fetch data from the related table
        if (field.type === 'relation' && field.relationType) {
          // Store the related table information
          processedField.relationTable = {
            _id: field.relationType._id,
            name: field.relationType.name,
          };

          // Get the related table
          const relatedTable = await Table.findById(field.relationType._id);

          if (relatedTable) {
            // Get all rows for the table
            const rows = await Row.find({
              tableId: field.relationType._id,
            })
              .select('_id position')
              .sort({ position: 1 });

            if (rows.length > 0) {
              // Get all records for these rows
              const records = await Record.find({
                tableId: field.relationType._id,
                rowId: { $in: rows.map((row) => row._id) },
              });

              // Create a map of rowId to record values for easier lookup
              const recordMap = new Map();
              records.forEach((record) => {
                if (!recordMap.has(record.rowId.toString())) {
                  recordMap.set(record.rowId.toString(), {});
                }
                const rowValues = recordMap.get(record.rowId.toString());
                rowValues[record.columnId] = record.values.get(record.columnId);
              });

              // Create select options and popover options from the rows
              processedField.selectOptions = rows.map((row) => {
                const rowValues = recordMap.get(row._id.toString()) || {};

                // Use lookupFields if available, otherwise fallback to all values
                let displayValue = '';
                if (
                  field.fieldSettings?.lookupFields &&
                  field.fieldSettings?.lookupFields?.length > 0
                ) {
                  displayValue = field.fieldSettings?.lookupFields
                    ?.map((fieldId) => rowValues[fieldId])
                    .filter((value) => value !== undefined && value !== null)
                    .join(' - ');
                } else {
                  // Fallback to all values
                  displayValue = Object.values(rowValues)
                    .filter((value) => value !== undefined && value !== null)
                    .join(', ');
                }

                return {
                  value: row._id.toString(),
                  label: displayValue || 'Unnamed Item',
                  rowData: rowValues,
                };
              });

              // Create popover options with a cleaner structure
              processedField.popoverOptions = rows.map((row) => {
                const rowValues = recordMap.get(row._id.toString()) || {};

                // Transform the row values into a clean array of field objects
                // Make sure all columns from the related table are included
                let fields = [];

                if (relatedTable && relatedTable.columns) {
                  // If lookupFields is available, only include those fields
                  if (
                    field.fieldSettings?.lookupFields &&
                    field.fieldSettings?.lookupFields?.length > 0
                  ) {
                    fields = field.fieldSettings.lookupFields
                      .map((fieldId) => {
                        const column = relatedTable.columns.find(
                          (col) => col && col.id === fieldId,
                        );
                        if (!column) return null;

                        const value = rowValues[fieldId] || '';

                        return {
                          id: fieldId,
                          value: value,
                          label: column.name || 'Field',
                          type: column.type || 'text',
                        };
                      })
                      .filter(Boolean);
                  } else {
                    // Include all columns from the related table, even if they don't have values
                    fields = relatedTable.columns
                      .map((column) => {
                        if (!column) return null;

                        const fieldId = column.id;
                        const value = rowValues[fieldId] || '';

                        return {
                          id: fieldId,
                          value: value,
                          label: column.name || 'Field',
                          type: column.type || 'text',
                        };
                      })
                      .filter(Boolean); // Remove any null values from the array
                  }
                } else {
                  // Fallback to the previous implementation if columns aren't available
                  // If lookupFields is available, only include those fields
                  if (
                    field.fieldSettings?.lookupFields &&
                    field.fieldSettings?.lookupFields?.length > 0
                  ) {
                    fields = field.fieldSettings.lookupFields.map((fieldId) => {
                      const value = rowValues[fieldId] || '';
                      let columnName = 'Field';
                      let columnType = 'text';

                      return {
                        id: fieldId,
                        value: value,
                        label: columnName,
                        type: columnType,
                      };
                    });
                  } else {
                    fields = Object.entries(rowValues).map(([fieldId, value]) => {
                      let columnName = 'Field';
                      let columnType = 'text';

                      if (relatedTable && relatedTable.columns) {
                        const column = relatedTable.columns.find(
                          (col) => col && col.id === fieldId,
                        );

                        if (column) {
                          columnName = column.name || 'Field';
                          columnType = column.type || 'text';
                        }
                      }

                      return {
                        id: fieldId,
                        value: value || '',
                        label: columnName,
                        type: columnType,
                      };
                    });
                  }
                }

                return {
                  rowId: row._id.toString(),
                  fields,
                };
              });
            } else {
              processedField.selectOptions = [];
              processedField.popoverOptions = [];
            }
          } else {
            processedField.selectOptions = [];
            processedField.popoverOptions = [];
          }
        }

        return processedField;
      }),
    );

    // Create the transformed data object
    const transformedData = {
      ...moduleTemplateObj,
      fields: processedFields,
    };

    res.status(200).json({
      success: true,
      data: transformedData,
      message: 'Module template retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default getModuleTemplateById;
