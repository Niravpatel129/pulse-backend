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
        required: true,
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
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
      default: 'draft',
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
