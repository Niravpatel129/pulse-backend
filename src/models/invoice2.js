import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
});

const invoiceTotalsSchema = new mongoose.Schema({
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
  taxAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  vatAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  discount: {
    type: Number,
    required: true,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
});

const invoiceSettingsSchema = new mongoose.Schema({
  currency: {
    type: String,
    required: true,
  },
  dateFormat: {
    type: String,
    required: true,
  },
  salesTax: {
    enabled: {
      type: Boolean,
      required: true,
    },
    rate: {
      type: Number,
      required: true,
    },
  },
  vat: {
    enabled: {
      type: Boolean,
      required: true,
    },
    rate: {
      type: Number,
      required: true,
    },
  },
  discount: {
    enabled: {
      type: Boolean,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
  },
  decimals: {
    type: String,
    required: true,
  },
});

const invoice2Schema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    invoiceTitle: {
      type: String,
    },
    customer: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
      },
      name: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: false,
      },
    },
    from: {
      type: String,
      required: true,
    },
    to: {
      type: String,
      required: true,
    },
    issueDate: {
      type: Date,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    items: [invoiceItemSchema],
    totals: invoiceTotalsSchema,
    notes: {
      type: String,
    },
    internalNote: {
      type: String,
      default: '',
    },
    logo: {
      type: String,
    },
    settings: invoiceSettingsSchema,
    status: {
      type: String,
      enum: ['draft', 'open', 'sent', 'paid', 'overdue', 'cancelled'],
      default: 'draft',
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: ['draft', 'open', 'sent', 'paid', 'overdue', 'cancelled'],
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        reason: {
          type: String,
        },
      },
    ],
    statusChangedAt: {
      type: Date,
    },
    statusChangedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    paymentDate: {
      type: Date,
    },
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'credit_card', 'cash', 'check', 'other'],
      default: 'bank_transfer',
    },
    paidAt: {
      type: Date,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

const Invoice2 = mongoose.model('Invoice2', invoice2Schema);

export default Invoice2;
