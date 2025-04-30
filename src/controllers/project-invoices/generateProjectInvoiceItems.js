import Record from '../../models/Table/Record.js';
import Row from '../../models/Table/Row.js';
import Table from '../../models/Table/Table.js';
import ApiResponse from '../../utils/apiResponse.js';

// === FAKE DATA SETUP FOR TESTING ===
const fakeProject = {
  deliverables: [
    {
      name: 'Custom T-Shirt & Setup Combo',
      description: 'High-quality custom t-shirts with professional setup service',
      labels: ['Apparel', 'Service'],
      createdAt: new Date('2023-11-28T10:00:00'),
      createdBy: {
        _id: '60d21b4667d0d8992e610c87',
        name: 'Jane Doe',
        email: 'jane@printstudio.com',
        avatar: 'https://cdn.printshop.com/avatars/jane.png',
        billableRate: 85,
      },
      fields: {
        records: [
          { tableId: '67f307118335aa034072b73d', rowId: '67f307118335aa034072b742' },
          { tableId: '67f307118335aa034072b73d', rowId: '67f307118335aa034072b742' },
        ],
        color: 'Navy Blue',
        sizeBreakdown: { S: 10, M: 20, L: 15, XL: 5 },
        unitPrice: 8.0,
        quantity: 50,
        total: 400.0,
        imageUrl: 'https://cdn.printshop.com/mockups/12345.png',
        notes: 'Includes onsite machine setup service',
      },
    },
    {
      name: 'Logo Vectorization',
      description: 'Professional conversion of bitmap logo to vector format',
      labels: ['Design', 'Digital'],
      createdAt: new Date('2023-11-29T14:30:00'),
      createdBy: {
        _id: '60d21b4667d0d8992e610c88',
        name: 'John Smith',
        email: 'john@printstudio.com',
        avatar: 'https://cdn.printshop.com/avatars/john.png',
        billableRate: 95,
      },
      fields: {
        records: [],
        description: 'Convert logo to SVG with Pantone colors',
        unitPrice: 100.0,
        quantity: 1,
        total: 100.0,
        revisionRounds: 3,
        designer: 'alice@printstudio.com',
        proofUrl: 'https://cdn.printshop.com/proofs/12345.svg',
      },
      attachments: [
        { type: 'proof', url: 'https://cdn.printshop.com/proofs/12345.svg', title: 'Logo Proof' },
      ],
    },
    {
      name: 'Promotional Sticker Pack',
      description: 'Custom die-cut promotional stickers',
      labels: ['Promotional', 'Small Format'],
      createdAt: new Date('2023-11-30T09:15:00'),
      createdBy: {
        _id: '60d21b4667d0d8992e610c8c',
        name: 'Sarah Johnson',
        email: 'sarah@printstudio.com',
        avatar: 'https://cdn.printshop.com/avatars/sarah.png',
        billableRate: 75,
      },
      fields: {
        records: [{ tableId: '67f307118335aa034072b73d', rowId: '67f307118335aa034072b742' }],
        stickerSize: '3-inch',
        unitPrice: 0.5,
        quantity: 500,
        total: 250.0,
        multiSelectColors: ['Red', 'White', 'Blue'],
      },
      attachments: [
        {
          type: 'image',
          url: 'https://cdn.printshop.com/mockups/stickers.png',
          title: 'Sticker Mockup',
        },
      ],
    },
  ],
  tasks: [
    {
      projectId: '60d21b4667d0d8992e610c85',
      title: 'Initial Brief Call',
      description: 'Discuss requirements and timeline',
      columnId: '60d21b4667d0d8992e610c86',
      priority: 'medium',
      assignee: {
        _id: '60d21b4667d0d8992e610c87',
        name: 'Jane Doe',
        avatar: 'https://cdn.printshop.com/avatars/jane.png',
        billableRate: 85,
      },
      reporter: {
        _id: '60d21b4667d0d8992e610c88',
        name: 'John Smith',
        avatar: 'https://cdn.printshop.com/avatars/john.png',
        billableRate: 95,
      },
      dueDate: new Date('2023-12-15'),
      labels: ['Meeting', 'Client'],
      storyPoints: 2,
      position: 1,
      timeEntries: [
        {
          hours: 1,
          description: 'Client onboarding call',
          recordedBy: {
            _id: '60d21b4667d0d8992e610c87',
            name: 'Jane Doe',
            avatar: 'https://cdn.printshop.com/avatars/jane.png',
            billableRate: 85,
          },
          recordedAt: new Date('2023-12-01T14:00:00'),
          isBillable: false,
        },
      ],
      totalHours: 1,
    },
    {
      projectId: '60d21b4667d0d8992e610c85',
      title: 'Proof Approval',
      description: 'Client approved mockup',
      columnId: '60d21b4667d0d8992e610c89',
      priority: 'high',
      assignee: {
        _id: '60d21b4667d0d8992e610c87',
        name: 'Jane Doe',
        avatar: 'https://cdn.printshop.com/avatars/jane.png',
        billableRate: 85,
      },
      reporter: {
        _id: '60d21b4667d0d8992e610c88',
        name: 'John Smith',
        avatar: 'https://cdn.printshop.com/avatars/john.png',
        billableRate: 95,
      },
      dueDate: new Date('2023-12-18'),
      labels: ['Design', 'Approval'],
      storyPoints: 1,
      position: 2,
      timeEntries: [],
      totalHours: 0,
    },
    {
      projectId: '60d21b4667d0d8992e610c85',
      title: 'Print Setup',
      description: 'Setup screens for printing',
      columnId: '60d21b4667d0d8992e610c8a',
      priority: 'medium',
      assignee: {
        _id: '60d21b4667d0d8992e610c8b',
        name: 'Mike Wilson',
        avatar: 'https://cdn.printshop.com/avatars/mike.png',
        billableRate: 65,
      },
      reporter: {
        _id: '60d21b4667d0d8992e610c87',
        name: 'Jane Doe',
        avatar: 'https://cdn.printshop.com/avatars/jane.png',
        billableRate: 85,
      },
      dueDate: new Date('2023-12-20'),
      labels: ['Production', 'Setup'],
      storyPoints: 3,
      position: 3,
      timeEntries: [
        {
          hours: 1,
          description: 'Screen preparation',
          recordedBy: {
            _id: '60d21b4667d0d8992e610c8b',
            name: 'Mike Wilson',
            avatar: 'https://cdn.printshop.com/avatars/mike.png',
            billableRate: 65,
          },
          recordedAt: new Date('2023-12-19T10:00:00'),
          isBillable: true,
        },
      ],
      totalHours: 1,
    },
    {
      projectId: '60d21b4667d0d8992e610c85',
      title: 'Quality Check',
      description: 'Inspect printed materials',
      columnId: '60d21b4667d0d8992e610c8a',
      priority: 'high',
      assignee: {
        _id: '60d21b4667d0d8992e610c8c',
        name: 'Sarah Johnson',
        avatar: 'https://cdn.printshop.com/avatars/sarah.png',
        billableRate: 75,
      },
      reporter: {
        _id: '60d21b4667d0d8992e610c87',
        name: 'Jane Doe',
        avatar: 'https://cdn.printshop.com/avatars/jane.png',
        billableRate: 85,
      },
      dueDate: new Date('2023-12-22'),
      labels: ['QA', 'Premium'],
      storyPoints: 2,
      position: 4,
      timeEntries: [
        {
          hours: 1.5,
          description: 'Initial quality inspection',
          recordedBy: {
            _id: '60d21b4667d0d8992e610c8c',
            name: 'Sarah Johnson',
            avatar: 'https://cdn.printshop.com/avatars/sarah.png',
            billableRate: 75,
          },
          recordedAt: new Date('2023-12-21T09:00:00'),
          isBillable: true,
        },
        {
          hours: 0.5,
          description: 'Final approval check',
          recordedBy: {
            _id: '60d21b4667d0d8992e610c8c',
            name: 'Sarah Johnson',
            avatar: 'https://cdn.printshop.com/avatars/sarah.png',
            billableRate: 75,
          },
          recordedAt: new Date('2023-12-21T15:00:00'),
          isBillable: true,
        },
      ],
      totalHours: 2,
    },
    {
      projectId: '60d21b4667d0d8992e610c85',
      title: 'Client Feedback',
      description: 'Incorporate final feedback',
      columnId: '60d21b4667d0d8992e610c8d',
      priority: 'medium',
      assignee: {
        _id: '60d21b4667d0d8992e610c87',
        name: 'Jane Doe',
        avatar: 'https://cdn.printshop.com/avatars/jane.png',
        billableRate: 85,
      },
      reporter: {
        _id: '60d21b4667d0d8992e610c88',
        name: 'John Smith',
        avatar: 'https://cdn.printshop.com/avatars/john.png',
        billableRate: 95,
      },
      dueDate: new Date('2023-12-23'),
      labels: ['Feedback', 'Client', 'Revisions'],
      storyPoints: 1,
      position: 5,
      timeEntries: [
        {
          hours: 0.5,
          description: 'Client feedback call',
          recordedBy: {
            _id: '60d21b4667d0d8992e610c87',
            name: 'Jane Doe',
            avatar: 'https://cdn.printshop.com/avatars/jane.png',
            billableRate: 85,
          },
          recordedAt: new Date('2023-12-22T13:00:00'),
          isBillable: true,
        },
      ],
      totalHours: 0.5,
    },
  ],
};

const generateProjectInvoiceItems = async (req, res) => {
  // Using fakeProject for now until DB connection is ready
  const project = fakeProject;

  // Enrich deliverables: fetch multiple record references per deliverable
  const enrichedDeliverables = [];
  for (const del of project.deliverables) {
    const relatedRecords = [];
    if (Array.isArray(del.fields.records)) {
      for (const ref of del.fields.records) {
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

    // Create a copy of fields without the records array
    const fieldsWithoutRecords = { ...del.fields };
    delete fieldsWithoutRecords.records;

    // Ensure the records field is always an array (even if empty)
    enrichedDeliverables.push({
      name: del.name,
      description: del.description || '',
      labels: del.labels || [],
      createdAt: del.createdAt || new Date(),
      createdBy: del.createdBy || null,
      fields: {
        ...fieldsWithoutRecords,
        linkedItems: relatedRecords,
      },
      attachments: del.attachments || [],
    });
  }

  // Map project tasks into invoice line items
  const invoiceTasks = [];

  project.tasks.forEach((task) => {
    // Group billable time entries by user
    const entriesByUser = {};

    task.timeEntries.forEach((entry) => {
      if (!entry.isBillable) return;

      const userId = entry.recordedBy._id;
      if (!entriesByUser[userId]) {
        entriesByUser[userId] = {
          user: entry.recordedBy,
          hours: 0,
          description: [],
        };
      }

      entriesByUser[userId].hours += entry.hours;
      if (entry.description) {
        entriesByUser[userId].description.push(entry.description);
      }
    });

    // Create separate invoice items for each user who logged time
    Object.values(entriesByUser).forEach((userEntry) => {
      if (userEntry.hours <= 0) return;

      const rate = userEntry.user.billableRate || 75; // Fallback to default rate
      const descriptions =
        userEntry.description.length > 0 ? userEntry.description.join('; ') : task.description;

      invoiceTasks.push({
        name: `${task.title} (${userEntry.user.name})`,
        description: descriptions,
        unitPrice: rate,
        quantity: userEntry.hours,
        total: rate * userEntry.hours,
        labels: task.labels || [],
        userId: userEntry.user._id,
      });
    });
  });

  // Build invoice data
  const invoiceData = {
    deliverables: enrichedDeliverables,
    projectTasks: invoiceTasks,
  };

  return res.status(200).json(new ApiResponse(200, invoiceData));
};

export default generateProjectInvoiceItems;
