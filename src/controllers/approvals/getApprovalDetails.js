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
      // Get the fields to process - either from versions or from content
      let fieldsToProcess = [];

      if (approval.moduleId.versions && approval.moduleId.versions.length > 0) {
        // If there are versions, use the latest version's fields
        const currentVersionIndex = approval.moduleId.versions.findIndex(
          (v) => v.number === approval.moduleId.currentVersion,
        );
        if (currentVersionIndex !== -1) {
          fieldsToProcess =
            approval.moduleId.versions[currentVersionIndex].contentSnapshot.fields || [];
        }
      } else if (approval.moduleId.content && approval.moduleId.content.fields) {
        // If no versions yet, use the content fields directly
        fieldsToProcess = approval.moduleId.content.fields;
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
      if (approval.moduleId.versions && approval.moduleId.versions.length > 0) {
        const currentVersionIndex = approval.moduleId.versions.findIndex(
          (v) => v.number === approval.moduleId.currentVersion,
        );
        if (currentVersionIndex !== -1) {
          approval.moduleId.versions[currentVersionIndex].contentSnapshot.fields = processedFields;
        }
      } else {
        approval.moduleId.content.fields = processedFields;
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
