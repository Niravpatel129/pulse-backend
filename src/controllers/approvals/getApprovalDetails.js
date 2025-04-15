import ModuleApproval from '../../models/ModuleApproval.js';
import Record from '../../models/Table/Record.js';
import Row from '../../models/Table/Row.js';
import Table from '../../models/Table/Table.js';
import AppError from '../../utils/AppError.js';

const getApprovalDetails = async (req, res, next) => {
  try {
    const { approvalId } = req.params;

    // Find the approval by ID with extensive population
    const approval = await ModuleApproval.findById(approvalId)
      .populate({
        path: 'moduleId',
        select: 'name description status moduleType content versions currentVersion addedBy',
        populate: [
          {
            path: 'content.fileId',
            select: 'name originalName downloadURL contentType size',
          },
          {
            path: 'content.templateId',
            select: 'name description fields',
          },
          {
            path: 'versions.contentSnapshot.fileId',
            select: 'name originalName downloadURL contentType size',
          },
          {
            path: 'versions.updatedBy',
            select: 'name email',
          },
          {
            path: 'addedBy',
            select: 'name email',
          },
        ],
      })
      .populate('requestedBy', 'name email')
      .populate('approverId', 'name email')
      .populate({
        path: 'timeline.performedBy',
        select: 'name email',
      });

    if (!approval) {
      return next(new AppError('Approval request not found', 404));
    }

    // Process the module if it's a template module
    if (approval.moduleId && approval.moduleId.moduleType === 'template') {
      // Get the current version's sections
      const currentVersionIndex = approval.moduleId.versions.findIndex(
        (v) => v.number === approval.moduleId.currentVersion,
      );

      if (currentVersionIndex !== -1) {
        const currentVersion = approval.moduleId.versions[currentVersionIndex];
        const sections = currentVersion.contentSnapshot.sections || [];

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

        // Update the current version's sections with processed fields
        approval.moduleId.versions[currentVersionIndex].contentSnapshot.sections =
          processedSections;
      }
    } else if (approval.moduleId && approval.moduleId.moduleType === 'figma') {
      // For Figma modules, ensure we have the latest version's content
      if (approval.moduleId.versions && approval.moduleId.versions.length > 0) {
        const currentVersionIndex = approval.moduleId.versions.findIndex(
          (v) => v.number === approval.moduleId.currentVersion,
        );
        if (currentVersionIndex !== -1) {
          // Ensure the content is up to date with the latest version
          approval.moduleId.content = {
            ...approval.moduleId.content,
            figmaUrl: approval.moduleId.versions[currentVersionIndex].contentSnapshot.figmaUrl,
            figmaFileKey:
              approval.moduleId.versions[currentVersionIndex].contentSnapshot.figmaFileKey,
          };
        }
      }
    }

    // Format timeline entries to include user/guest information
    const formattedTimeline = approval.timeline.map((entry) => {
      const formattedEntry = { ...entry.toObject() };

      // If there's a performedBy (authenticated user), use their info
      if (entry.performedBy) {
        formattedEntry.user = {
          name: entry.performedBy.name,
          email: entry.performedBy.email,
          isGuest: false,
        };
      }
      // If there's guestInfo, use that
      else if (entry.guestInfo) {
        formattedEntry.user = {
          name: entry.guestInfo.name,
          email: entry.guestInfo.email,
          isGuest: true,
        };
      }

      // Remove the raw fields
      delete formattedEntry.performedBy;
      delete formattedEntry.guestInfo;

      return formattedEntry;
    });

    // Replace the timeline with the formatted version
    approval.timeline = formattedTimeline;

    res.status(200).json({
      status: 'success',
      data: approval,
    });
  } catch (error) {
    next(error);
  }
};

export default getApprovalDetails;
