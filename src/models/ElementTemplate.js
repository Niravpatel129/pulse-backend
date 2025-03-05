import mongoose from 'mongoose';

const elementTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    fields: [
      {
        name: {
          type: String,
          required: true,
        },
        label: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ['text', 'number', 'date', 'boolean', 'file', 'select', 'email', 'url', 'textarea'],
          required: true,
        },
        required: {
          type: Boolean,
          default: false,
        },
        options: [String], // For select fields
        defaultValue: mongoose.Schema.Types.Mixed,
      },
    ],
    isGlobal: {
      type: Boolean,
      default: false,
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

const ElementTemplate = mongoose.model('ElementTemplate', elementTemplateSchema);

export default ElementTemplate;
