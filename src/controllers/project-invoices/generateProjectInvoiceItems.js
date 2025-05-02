import Deliverable from '../../models/Deliverable.js';
import KanbanTask from '../../models/KanbanTask.js';
import Record from '../../models/Table/Record.js';
import Row from '../../models/Table/Row.js';
import Table from '../../models/Table/Table.js';
import ApiResponse from '../../utils/apiResponse.js';

const generateProjectInvoiceItems = async (req, res) => {
  try {
    // Extract projectId from request
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json(new ApiResponse(400, null, 'Project ID is required'));
    }

    // Fetch real deliverables for the specific project
    const deliverables = await Deliverable.find({ project: projectId }).populate('createdBy');

    // Fetch real tasks for the specific project
    const tasks = await KanbanTask.find({
      projectId: projectId,
      _deleted: { $ne: true },
      _archived: { $ne: true },
    }).populate('assignee.id reporter.id');

    // Use the real data
    const project = {
      deliverables,
      tasks,
    };
    console.log('🚀 tasks:', tasks);

    // Enrich deliverables: fetch multiple record references per deliverable
    const enrichedDeliverables = [];
    for (const del of project.deliverables) {
      // Extract records from customFields where type is 'databaseItem'
      const recordRefs = [];
      if (del.customFields && Array.isArray(del.customFields)) {
        del.customFields.forEach((field) => {
          if (field.type === 'databaseItem' && field.selectedItem) {
            recordRefs.push({
              tableId: field.selectedDatabaseId,
              rowId: field.selectedItem.id,
            });
          }
        });
      }

      const relatedRecords = [];
      if (recordRefs.length > 0) {
        for (const ref of recordRefs) {
          try {
            // Get the related table first
            const relatedTable = await Table.findById(ref.tableId);
            if (!relatedTable) {
              relatedRecords.push({
                tableId: ref.tableId,
                rowId: ref.rowId,
                message: 'Related table not found',
              });
              continue;
            }

            // Create a map of column IDs to their names
            const columnNameMap = {};
            relatedTable.columns.forEach((col) => {
              columnNameMap[col.id] = col.name;
            });

            // Get the row
            const row = await Row.findById(ref.rowId);
            if (!row) {
              relatedRecords.push({
                tableId: ref.tableId,
                rowId: ref.rowId,
                message: 'Row not found',
              });
              continue;
            }

            // Get all records for this row
            const records = await Record.find({
              tableId: ref.tableId,
              rowId: ref.rowId,
            });

            if (records.length === 0) {
              relatedRecords.push({
                tableId: ref.tableId,
                rowId: ref.rowId,
                message: 'No records found for this row',
              });
              continue;
            }

            // Create a map of column values with proper names
            const columnValues = {};
            records.forEach((record) => {
              const columnName = columnNameMap[record.columnId];
              if (columnName) {
                columnValues[columnName] = record.values.get(record.columnId);
              }
            });

            // Add the enriched record data
            relatedRecords.push({
              rowId: ref.rowId,
              tableId: ref.tableId,
              tableName: relatedTable.name,
              displayValues: columnValues,
              placeholder: false,
              source: {
                tableId: ref.tableId,
                rowId: ref.rowId,
                tableName: relatedTable.name || 'Unknown Table',
              },
            });
          } catch (err) {
            // Add error record for debugging purposes
            relatedRecords.push({
              tableId: ref.tableId,
              rowId: ref.rowId,
              error: err.message,
              message: 'Error fetching record',
            });
          }
        }
      }

      // Map fields from the real Deliverable model to match the expected format
      const fields = {
        unitPrice: parseFloat(del.price) || 0,
        quantity: 1,
        total: parseFloat(del.price) || 0,
      };

      // Extract attachments from customFields
      const attachments = [];
      if (del.customFields && Array.isArray(del.customFields)) {
        del.customFields.forEach((field) => {
          if (field.type === 'attachment' && Array.isArray(field.attachments)) {
            field.attachments.forEach((attachment) => {
              attachments.push({
                type: attachment.type || 'file',
                url: attachment.url,
                title: attachment.name || field.label,
              });
            });
          }
        });
      }

      // Ensure the records field is always an array (even if empty)
      enrichedDeliverables.push({
        _id: del._id.toString(),
        name: del.name,
        description: del.description || '',
        labels: [del.deliverableType, del.customDeliverableType].filter(Boolean),
        createdAt: del.createdAt || new Date(),
        createdBy: del.createdBy
          ? {
              _id: del.createdBy._id,
              name: del.createdBy.name || 'Unknown',
              email: del.createdBy.email || '',
              avatar: del.createdBy.avatar || '',
              billableRate: del.createdBy.billableRate || 75,
            }
          : null,
        fields: {
          ...fields,
          ...(relatedRecords.length > 0 && { linkedItems: relatedRecords }),
        },
        attachments: attachments,
      });
    }

    // Map project tasks into invoice line items
    const invoiceTasks = [];

    project.tasks.forEach((task) => {
      // Group billable time entries by user
      const entriesByUser = {};

      if (task.timeEntries && task.timeEntries.length > 0) {
        task.timeEntries.forEach((entry) => {
          if (!entry.isBillable) return;

          const userId = entry.user.id.toString();
          if (!entriesByUser[userId]) {
            entriesByUser[userId] = {
              user: {
                _id: entry.user.id,
                name: entry.user.name || 'Unknown',
                avatar: entry.user.avatar || '',
                // Try to get billableRate from populated user or default to 75
                billableRate: (entry.user.id && entry.user.id.billableRate) || 75,
              },
              hours: 0,
              description: [],
            };
          }

          entriesByUser[userId].hours += entry.hours;
          if (entry.description) {
            entriesByUser[userId].description.push(entry.description);
          }
        });
      }

      // If no billable time entries, still include the task with the assignee
      if (Object.keys(entriesByUser).length === 0) {
        let assigneeData = null;

        // Use assignee if available
        if (task.assignee && task.assignee.id) {
          assigneeData = {
            _id: task.assignee.id,
            name: task.assignee.name || 'Unknown',
            avatar: task.assignee.avatar || '',
            billableRate: (task.assignee.id && task.assignee.id.billableRate) || 75,
          };
        }
        // Fall back to reporter if no assignee
        else if (task.reporter && task.reporter.id) {
          assigneeData = {
            _id: task.reporter.id,
            name: task.reporter.name || 'Unknown',
            avatar: task.reporter.avatar || '',
            billableRate: (task.reporter.id && task.reporter.id.billableRate) || 75,
          };
        }
        // Create a default user if neither assignee nor reporter is available
        else {
          assigneeData = {
            _id: 'unassigned',
            name: 'Unassigned',
            avatar: '',
            billableRate: 75,
          };
        }

        invoiceTasks.push({
          _id: task._id.toString(),
          name: task.title,
          description: task.description || '',
          unitPrice: assigneeData.billableRate || 75,
          quantity: 0,
          total: 0,
          labels: task.labels || [],
          userId: assigneeData._id,
          billable: false,
          assigneeData: assigneeData,
        });
      } else {
        // Create separate invoice items for each user who logged time
        Object.values(entriesByUser).forEach((userEntry) => {
          // Include tasks even with 0 hours
          const rate = userEntry.user.billableRate || 75; // Fallback to default rate
          const descriptions =
            userEntry.description.length > 0
              ? userEntry.description.join('; ')
              : task.description || '';

          invoiceTasks.push({
            _id: task._id.toString(),
            name: `${task.title} (${userEntry.user.name})`,
            description: descriptions,
            unitPrice: rate,
            quantity: userEntry.hours,
            total: rate * userEntry.hours,
            labels: task.labels || [],
            userId: userEntry.user._id,
            billable: true,
            assigneeData: userEntry.user,
          });
        });
      }
    });

    // Build invoice data
    const invoiceData = {
      deliverables: enrichedDeliverables,
      projectTasks: invoiceTasks,
    };

    return res.status(200).json(new ApiResponse(200, invoiceData));
  } catch (error) {
    console.error('Error generating project invoice items:', error);
    return res.status(500).json(new ApiResponse(500, null, 'Failed to generate invoice items'));
  }
};

export default generateProjectInvoiceItems;
