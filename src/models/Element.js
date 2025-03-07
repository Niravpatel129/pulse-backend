import mongoose from 'mongoose';

// Base schema for all element types
const elementSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['file', 'form', 'invoice', 'product', 'design'], // Add more types as needed
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    status: {
      type: String,
      enum: ['draft', 'pending', 'in_progress', 'completed', 'rejected'],
      default: 'draft',
    },
    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
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
    discriminatorKey: 'elementType', // This is used to differentiate between element types
  },
);

const Element = mongoose.model('Element', elementSchema);

export default Element;
