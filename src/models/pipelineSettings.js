import mongoose from 'mongoose';

const pipelineSettingsSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      unique: true,
    },
    stages: {
      type: [String],
      default: ['Initial Contact', 'Needs Analysis', 'Proposal', 'Closed Won', 'Closed Lost'],
    },
    statuses: {
      type: [String],
      default: ['Not Started', 'On Track', 'At Risk', 'Delayed', 'Completed'],
    },
  },
  {
    timestamps: true,
  },
);

const PipelineSettings = mongoose.model('PipelineSettings', pipelineSettingsSchema);

export default PipelineSettings;
