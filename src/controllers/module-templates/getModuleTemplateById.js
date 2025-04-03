import ModuleTemplate from '../../models/ModuleTemplate.js';
import Record from '../../models/Table/Record.js';
import Row from '../../models/Table/Row.js';
import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';
import transformModuleTemplateForForm from '../../utils/moduleTemplateTransformer.js';

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

    // Transform the data to include all necessary information for form building
    const transformedData = {
      ...moduleTemplate.toObject(),
      fields: await Promise.all(
        moduleTemplate.fields.map(async (field) => {
          // Convert field to object and remove lookupFields property
          const fieldObj = field.toObject();
          delete fieldObj.lookupFields;

          const fieldData = {
            ...fieldObj,
            description: fieldObj.description || '',
            options: fieldObj.options || [],
          };

          // If it's a relation field, include the related table information
          if (fieldData.type === 'relation' && fieldData.relationType) {
            fieldData.relationTable = {
              _id: fieldData.relationType._id,
              name: fieldData.relationType.name,
            };

            // Get the related table
            const relatedTable = await Table.findById(fieldData.relationType._id);

            if (relatedTable) {
              // Get all rows for the table
              const rows = await Row.find({
                tableId: fieldData.relationType._id,
              })
                .select('_id position')
                .sort({ position: 1 });

              if (rows.length > 0) {
                // Get the records for these rows
                const records = await Record.find({
                  tableId: fieldData.relationType._id,
                  rowId: { $in: rows.map((row) => row._id) },
                }).select('rowId values');

                // Create a map of rowId to record values for easier lookup
                const recordMap = new Map();
                records.forEach((record) => {
                  if (!recordMap.has(record.rowId.toString())) {
                    recordMap.set(record.rowId.toString(), {});
                  }
                  const rowValues = recordMap.get(record.rowId.toString());
                  rowValues[record.columnId] = record.values.get(record.columnId);
                });

                // Map rows to include all values as a single string
                fieldData.lookupItems = rows.map((row) => {
                  const rowValues = recordMap.get(row._id.toString()) || {};

                  // Convert all values to a single string
                  const displayValue = Object.values(rowValues)
                    .filter((value) => value !== undefined && value !== null)
                    .join(' - ');

                  return {
                    _id: row._id,
                    name: displayValue || 'Unnamed Item',
                    values: rowValues,
                  };
                });
              } else {
                fieldData.lookupItems = [];
              }
            } else {
              fieldData.lookupItems = [];
            }
          }

          return fieldData;
        }),
      ),
    };

    // Transform the data for frontend form rendering
    const formData = transformModuleTemplateForForm(transformedData);

    res.status(200).json({
      success: true,
      data: transformedData,
      formData: formData,
      message: 'Module template retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default getModuleTemplateById;
