import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    client: {
      name: String,
      email: String,
      address: String,
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
    items: [
      {
        description: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        unitPrice: {
          type: Number,
          required: true,
        },
        taxRate: {
          type: Number,
          default: 0,
        },
        amount: Number, // Calculated field (quantity * unitPrice)
      },
    ],
    subtotal: Number,
    taxTotal: Number,
    discounts: [
      {
        description: String,
        amount: Number,
      },
    ],
    total: Number,
    currency: {
      type: String,
      default: 'USD',
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'],
      default: 'draft',
    },
    issueDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: Date,
    paymentTerms: String,
    notes: String,
    paymentDetails: {
      method: String,
      transactionId: String,
      paidAmount: Number,
      paidDate: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const Invoice = mongoose.model('Invoice', invoiceSchema);

export default Invoice;
