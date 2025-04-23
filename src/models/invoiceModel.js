import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Participant',
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    items: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductCatalog',
      },
    ],
    discount: {
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
    total: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'open', 'archived'],
      default: 'draft',
    },
    dueDate: {
      type: Date,
      required: true,
    },
    notes: String,
    paymentTerms: String,
    currency: {
      type: String,
      default: 'USD',
    },
    deliveryMethod: {
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
  },
  {
    timestamps: true,
  },
);

// Add indexes for better query performance
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ client: 1 });
invoiceSchema.index({ project: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ workspace: 1 });
invoiceSchema.index({ paymentIntentId: 1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);

export default Invoice;
