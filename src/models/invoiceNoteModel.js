import mongoose from 'mongoose';

const invoiceNoteSchema = new mongoose.Schema(
  {
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      required: true,
      default: '#fff',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Add indexes for better query performance
invoiceNoteSchema.index({ invoice: 1, createdAt: -1 });
invoiceNoteSchema.index({ workspace: 1 });

const InvoiceNote = mongoose.model('InvoiceNote', invoiceNoteSchema);

export default InvoiceNote;
