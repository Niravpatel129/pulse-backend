import mongoose from 'mongoose';

const invoiceTaxRateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    description: {
      type: String,
      default: '',
    },
    isDefault: {
      type: Boolean,
      default: false,
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
  },
  {
    timestamps: true,
  },
);

// Add indexes for better query performance
invoiceTaxRateSchema.index({ workspace: 1 });
invoiceTaxRateSchema.index({ workspace: 1, isDefault: 1 });

const InvoiceTaxRate = mongoose.model('InvoiceTaxRate', invoiceTaxRateSchema);

export default InvoiceTaxRate;
