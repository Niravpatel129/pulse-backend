import Record from '../models/Table/Record.js';
import Row from '../models/Table/Row.js';
import Table from '../models/Table/Table.js';

/**
 * Processes a template module's sections and their fields, including relations
 * @param {Object} module - The module object containing versions and sections
 * @returns {Promise<Object>} - The processed module with updated sections
 */
export const processTemplateModule = async (module) => {
  // Process all versions
  const processedVersions = await Promise.all(
    module.versions.map(async (version) => {
      const sections = version.contentSnapshot.sections || [];

      // Process each section's fields
      const processedSections = await Promise.all(
        sections.map(async (section) => {
          const processedFields = await Promise.all(
            section.fields.map(async (field) => {
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
                    if (!value) return null;

                    // Handle both string ID and object formats
                    const rowId = typeof value === 'string' ? value : value.rowId;
                    if (!rowId) return null;

                    // Get the row
                    const row = await Row.findById(rowId);
                    if (!row) return null;

                    // Get all records for this row
                    const records = await Record.find({
                      tableId: field.relationType,
                      rowId: rowId,
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
                      rowId: rowId,
                      displayValues: columnValues,
                      selectedAt:
                        typeof value === 'object' ? value.selectedAt : new Date().toISOString(),
                    };
                  };

                  if (field.multiple) {
                    // Process multiple relations
                    field.fieldValue = await Promise.all(
                      field.fieldValue.map(processRelationValue),
                    );
                    field.fieldValue = field.fieldValue.filter(Boolean); // Remove null values
                  } else {
                    // Process single relation
                    field.fieldValue = await processRelationValue(field.fieldValue);
                  }

                  // Add additional metadata about the relation
                  field.relationMetadata = {
                    tableId: field.relationType,
                    tableName: relatedTable.name,
                    tableDescription: relatedTable.description,
                    columns: relatedTable.columns.map((col) => ({
                      id: col.id,
                      name: col.name,
                      type: col.type,
                    })),
                  };
                }
              }
              return field;
            }),
          );

          return {
            ...section,
            fields: processedFields,
          };
        }),
      );

      return {
        ...version,
        contentSnapshot: {
          ...version.contentSnapshot,
          sections: processedSections,
        },
      };
    }),
  );

  return {
    ...module,
    versions: processedVersions,
  };
};
