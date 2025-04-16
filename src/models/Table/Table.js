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
    icon: {
      type: String,
      default: 'text',
    },
    type: {
      type: String,
      enum: [
        'text',
        'single_line',
        'long_text',
        'number',
        'date',
        'checkbox',
        'single_select',
        'multi_select',
        'user',
        'attachment',
        'image',
        'url',
        'email',
        'phone',
        'currency',
        'percent',
        'rating',
        'time',
        'last_modified',
        'formula',
        'lookup',
      ],
      default: 'single_line',
    },
    isPrimaryKey: {
      type: Boolean,
      default: false,
    },
    options: {
      // For select/multiselect types
      selectOptions: [
        {
          id: String,
          name: String,
          color: String,
        },
      ],
      // For formula type
      formula: String,
      // For currency type
      currencySymbol: {
        type: String,
        default: '$',
      },
      // For number/currency types
      hasDecimals: {
        type: Boolean,
        default: false,
      },
      decimalPlaces: {
        type: Number,
        default: 2,
      },
      // For number, percent, rating types
      minValue: String,
      maxValue: String,
      // For date type
      dateFormat: {
        type: String,
        default: 'MM/DD/YYYY',
      },
      // For phone type
      phoneFormat: {
        type: String,
        default: 'international',
      },
      // For checkbox/boolean types
      defaultChecked: {
        type: Boolean,
        default: false,
      },
      // For reference/lookup type
      referencedTable: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Table',
      },
      referencedColumn: String,
      // AG Grid options
      headerAlignment: {
        type: String,
        enum: ['left', 'center', 'right'],
        default: 'left',
      },
      cellAlignment: {
        type: String,
        enum: ['left', 'center', 'right'],
        default: 'left',
      },
      minWidth: {
        type: Number,
        default: 60,
      },
      defaultWidth: {
        type: Number,
        default: 200,
      },
      showAsBadges: {
        type: Boolean,
        default: true,
      },
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
    // AG Grid specific options
    allowSorting: {
      type: Boolean,
      default: true,
    },
    allowFiltering: {
      type: Boolean,
      default: true,
    },
    allowEditing: {
      type: Boolean,
      default: true,
    },
    allowResizing: {
      type: Boolean,
      default: true,
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
          type: 'single_line',
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
