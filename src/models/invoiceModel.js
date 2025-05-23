import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    selectedClient: {
      type: Object,
    },
    dateSent: {
      type: Date,
    },
    datePaid: {
      type: Date,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    items: [
      {
        name: {
          type: String,
          required: true,
        },
        description: {
          type: String,
        },
        quantity: {
          type: Number,
          required: true,
          default: 1,
        },
        price: {
          type: Number,
          required: true,
        },
        discount: {
          type: Number,
          default: 0,
        },
        tax: {
          type: Number,
          default: 0,
        },
        taxName: {
          type: String,
          default: 'VAT',
        },
      },
    ],
    selectedItems: {
      type: Array,
    },
    discount: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      default: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    taxId: {
      type: String,
    },
    showTaxId: {
      type: Boolean,
      default: false,
    },
    selectedTax: {
      type: Object,
    },
    shipping: {
      type: Object,
    },
    shippingTotal: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        'draft',
        'sent',
        'paid',
        'overdue',
        'overpaid',
        'cancelled',
        'open',
        'archived',
        'deposit_paid',
        'partially_paid',
      ],
      default: 'draft',
    },
    dueDate: {
      type: Date,
    },
    notes: String,
    teamNotes: String,
    teamNotesAttachments: {
      type: [
        {
          id: { type: String },
          name: { type: String },
          url: { type: String },
          type: { type: String },
          size: { type: String },
        },
      ],
      default: [],
    },
    paymentTerms: String,
    currency: {
      type: String,
      default: 'USD',
    },
    deliveryOptions: {
      type: String,
      enum: ['email', 'sms', 'both'],
      default: 'email',
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    paymentIntentId: {
      type: String,
      unique: true,
      sparse: true,
    },
    paidAt: {
      type: Date,
    },
    requireDeposit: {
      type: Boolean,
      default: false,
    },
    depositPercentage: {
      type: Number,
      default: 50,
    },
    starred: {
      type: Boolean,
      default: false,
    },
    timeline: [
      {
        type: {
          type: String,
          enum: [
            'created',
            'updated',
            'sent',
            'viewed',
            'payment_attempted',
            'payment_failed',
            'payment_succeeded',
            'status_change',
            'reminder_sent',
            'note_added',
            'custom',
          ],
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        actor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        metadata: {
          type: Object,
          default: {},
        },
        description: {
          type: String,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Add indexes for better query performance
// invoiceSchema.index({ invoiceNumber: 1 }); - Removed as it's already indexed with unique: true
invoiceSchema.index({ client: 1 });
invoiceSchema.index({ project: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ workspace: 1 });
// invoiceSchema.index({ paymentIntentId: 1 }); - Removed as it's already indexed with unique: true
invoiceSchema.index({ 'timeline.timestamp': 1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);

export default Invoice;
