import ProjectModule from '../../models/ProjectModule.js';
import Record from '../../models/Table/Record.js';
import Row from '../../models/Table/Row.js';
import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';

const getModuleDetails = async (req, res, next) => {
  try {
    const { moduleId } = req.params;

    const module = await ProjectModule.findById(moduleId)
      .populate('content.fileId')
      .populate('content.templateId')
      .populate('addedBy')
      .populate('versions.updatedBy');

    if (!module) {
      throw new AppError('Module not found', 404);
    }

    // If it's a template module, process the fields including relations
    if (module.moduleType === 'template') {
      // Get the fields to process - either from versions or from content
      let fieldsToProcess = [];

      if (module.versions && module.versions.length > 0) {
        // If there are versions, use the latest version's fields
        const currentVersionIndex = module.versions.findIndex(
          (v) => v.number === module.currentVersion,
        );
        if (currentVersionIndex !== -1) {
          fieldsToProcess = module.versions[currentVersionIndex].contentSnapshot.fields || [];
        }
      } else if (module.content && module.content.fields) {
        // If no versions yet, use the content fields directly
        fieldsToProcess = module.content.fields;
      }

      // Process each field to handle relations
      const processedFields = await Promise.all(
        fieldsToProcess.map(async (field) => {
          if (field.fieldType === 'relation' && field.fieldValue) {
            // Get the related table
            const relatedTable = await Table.findById(field.relationType);

            if (relatedTable) {
              // Create a map of column IDs to their names
              const columnNameMap = {};
              relatedTable.columns.forEach((col) => {
                columnNameMap[col.id] = col.name;
              });

              // Process single or multiple relations
              const processRelationValue = async (value) => {
                if (!value || !value.rowId) return null;

                // Get the row
                const row = await Row.findById(value.rowId);
                if (!row) return null;

                // Get all records for this row
                const records = await Record.find({
                  tableId: field.relationType,
                  rowId: value.rowId,
                });

                // Create a map of column values with proper names
                const columnValues = {};
                records.forEach((record) => {
                  const columnName = columnNameMap[record.columnId];
                  if (columnName) {
                    columnValues[columnName] = record.values.get(record.columnId);
                  }
                });

                return {
                  rowId: value.rowId,
                  displayValues: columnValues,
                  selectedAt: value.selectedAt,
                };
              };

              if (field.multiple) {
                // Process multiple relations
                field.fieldValue = await Promise.all(field.fieldValue.map(processRelationValue));
                field.fieldValue = field.fieldValue.filter(Boolean); // Remove null values
              } else {
                // Process single relation
                field.fieldValue = await processRelationValue(field.fieldValue);
              }
            }
          }
          return field;
        }),
      );

      // Update the appropriate fields array
      if (module.versions && module.versions.length > 0) {
        const currentVersionIndex = module.versions.findIndex(
          (v) => v.number === module.currentVersion,
        );
        if (currentVersionIndex !== -1) {
          module.versions[currentVersionIndex].contentSnapshot.fields = processedFields;
        }
      } else {
        module.content.fields = processedFields;
      }
    }

    res.status(200).json({
      status: 'success',
      data: module,
    });
  } catch (error) {
    next(error);
  }
};

export default getModuleDetails;
