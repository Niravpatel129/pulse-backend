import mongoose from 'mongoose';
import Record from './Record.js';

const columnSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        'text',
        'number',
        'date',
        'boolean',
        'select',
        'multiselect',
        'user',
        'file',
        'url',
        'email',
        'phone',
        'currency',
        'percent',
        'formula',
        'lookup',
        'link',
      ],
      default: 'text',
    },
    isPrimaryKey: {
      type: Boolean,
      default: false,
    },
    options: {
      // For select/multiselect types
      selectOptions: [
        {
          value: String,
          color: String,
        },
      ],
      // For formula type
      formula: String,
      // For currency type
      currencySymbol: String,
      // For reference/lookup type
      referencedTable: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Table',
      },
      referencedColumn: String,
      // Common options
      defaultValue: mongoose.Schema.Types.Mixed,
    },
    isRequired: {
      type: Boolean,
      default: false,
    },
    isUnique: {
      type: Boolean,
      default: false,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      default: '',
    },
    order: {
      type: Number,
      required: true,
    },
  },
  { _id: false },
);

// Main table schema definition
const tableSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    columns: [columnSchema],
    views: [
      {
        id: {
          type: String,
          required: true,
          default: () => new mongoose.Types.ObjectId().toString(),
        },
        name: {
          type: String,
          required: true,
          default: 'Grid view',
        },
        type: {
          type: String,
          enum: ['grid', 'kanban', 'gallery', 'form', 'calendar'],
          default: 'grid',
        },
        filters: [
          {
            columnId: String,
            operator: {
              type: String,
              enum: [
                'equals',
                'notEquals',
                'contains',
                'notContains',
                'isEmpty',
                'isNotEmpty',
                'greaterThan',
                'lessThan',
                'between',
              ],
            },
            value: mongoose.Schema.Types.Mixed,
          },
        ],
        sorts: [
          {
            columnId: String,
            direction: {
              type: String,
              enum: ['asc', 'desc'],
              default: 'asc',
            },
          },
        ],
        visibleColumns: [String], // Array of column IDs
        groupBy: String, // Column ID
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
tableSchema.index({ workspace: 1 });
tableSchema.index({ name: 'text', description: 'text' });

// Pre-save hook to ensure a primary key column exists (defaults to 'Name')
tableSchema.pre('save', function (next) {
  if (this.isNew) {
    // Create default "Name" column as primary key if no columns exist
    if (!this.columns || this.columns.length === 0) {
      this.columns = [
        {
          id: new mongoose.Types.ObjectId().toString(),
          name: 'Name',
          type: 'text',
          isPrimaryKey: true,
          isRequired: true,
          order: 0,
        },
      ];
    }

    // Create default grid view if no views exist
    if (!this.views || this.views.length === 0) {
      this.views = [
        {
          id: new mongoose.Types.ObjectId().toString(),
          name: 'Grid view',
          type: 'grid',
          visibleColumns: this.columns.map((col) => col.id),
        },
      ];
    }
  }
  next();
});

const Table = mongoose.model('Table', tableSchema);

// Cascade delete records when a table is deleted
tableSchema.pre('remove', async function (next) {
  await Record.deleteMany({ tableId: this._id });
  next();
});

export default Table;
