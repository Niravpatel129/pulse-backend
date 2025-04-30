import Record from '../../models/Table/Record.js';
import Row from '../../models/Table/Row.js';
import Table from '../../models/Table/Table.js';
import ApiResponse from '../../utils/apiResponse.js';

// === FAKE DATA SETUP FOR TESTING ===
const fakeProject = {
  deliverables: [
    {
      name: 'Custom T-Shirt & Setup Combo',
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
      title: 'Initial Brief Call',
      description: 'Discuss requirements and timeline',
      isBillable: false,
      hours: 1,
      rate: 0,
    },
    {
      title: 'Proof Approval',
      description: 'Client approved mockup',
      isBillable: false,
      hours: 0,
      rate: 0,
    },
    {
      title: 'Print Setup',
      description: 'Setup screens for printing',
      isBillable: true,
      hours: 1,
      rate: 50,
    },
    {
      title: 'Quality Check',
      description: 'Inspect printed materials',
      isBillable: true,
      hours: 2,
      rate: 25,
      labels: ['QA', 'Premium'],
    },
    {
      title: 'Client Feedback',
      description: 'Incorporate final feedback',
      isBillable: true,
      hours: 0.5,
      rate: 75,
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
              placeholder: true,
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
              placeholder: true,
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
              placeholder: true,
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
            placeholder: true,
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
      fields: fieldsWithoutRecords,
      attachments: del.attachments || [],
      records: relatedRecords,
    });
  }

  // Map project tasks into invoice line items
  const invoiceTasks = project.tasks.map((task) => ({
    name: task.title,
    description: task.description,
    unitPrice: task.isBillable ? task.rate : 0,
    quantity: task.hours || 1,
    total: (task.isBillable ? task.rate : 0) * (task.hours || 1),
    labels: task.labels || [],
  }));

  // Build invoice data
  const invoiceData = {
    deliverables: enrichedDeliverables,
    projectTasks: invoiceTasks,
  };

  return res.status(200).json(new ApiResponse(200, invoiceData));
};

export default generateProjectInvoiceItems;
