import mongoose from 'mongoose';

const moduleSchema = new mongoose.Schema(
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
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'archived'],
      default: 'draft',
    },
    elements: [
      {
        elementId: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'elements.elementType',
        },
        elementType: {
          type: String,
          enum: ['Form', 'Invoice', 'Product', 'DesignFile', 'CustomElement'],
          required: true,
        },
        status: {
          type: String,
          enum: ['pending', 'in_progress', 'completed', 'rejected'],
          default: 'pending',
        },
      },
    ],
    order: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isTemplate: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const Module = mongoose.model('Module', moduleSchema);

export default Module;
