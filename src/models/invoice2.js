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
    attachments: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'File',
          required: false,
        },
      ],
      validate: {
        validator: function (v) {
          return v.length <= 10;
        },
        message: 'Attachments cannot exceed 10 items',
      },
    },
    customer: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
      },
      name: {
        type: String,
        required: false,
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
    statusHistory: {
      type: [
        {
          status: {
            type: String,
            enum: ['draft', 'open', 'sent', 'paid', 'overdue', 'cancelled', 'seen'],
            required: true,
          },
          changedAt: {
            type: Date,
            default: Date.now,
          },
          changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
          },
          reason: {
            type: String,
          },
        },
      ],
      validate: {
        validator: function (v) {
          return v.length <= 50;
        },
        message: 'Status history cannot exceed 50 entries',
      },
    },
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
      enum: ['bank_transfer', 'credit_card', 'cash', 'check', 'other', 'stripe'],
      default: 'bank_transfer',
    },
    paidAt: {
      type: Date,
    },
    paymentIntentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    requireDeposit: {
      type: Boolean,
      default: false,
    },
    depositPercentage: {
      type: Number,
      default: 50,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    source: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

const Invoice2 = mongoose.model('Invoice2', invoice2Schema);

export default Invoice2;
