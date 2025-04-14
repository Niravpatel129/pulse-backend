import mongoose from 'mongoose';

const templateFieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['text', 'number', 'date', 'select', 'relation', 'files'],
    default: 'text',
  },
  description: {
    type: String,
    trim: true,
  },
  required: {
    type: Boolean,
    default: false,
  },
  options: {
    type: [String],
    default: [],
  },
  fieldSettings: {
    type: Object,
    default: {},
  },
  relationType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
  },
  multiple: {
    type: Boolean,
    default: false,
  },
});

const moduleTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    fields: [templateFieldSchema],
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace is required'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
    },
  },
  {
    timestamps: true,
  },
);

const ModuleTemplate = mongoose.model('ModuleTemplate', moduleTemplateSchema);

export default ModuleTemplate;
