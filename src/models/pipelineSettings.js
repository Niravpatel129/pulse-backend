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
      type: [
        {
          name: String,
          order: Number,
          color: String,
        },
      ],
      default: [
        { name: 'Initial Contact', order: 0, color: '#4299E1' },
        { name: 'Needs Analysis', order: 1, color: '#48BB78' },
        { name: 'Proposal', order: 2, color: '#ECC94B' },
        { name: 'Closed Won', order: 3, color: '#38A169' },
        { name: 'Closed Lost', order: 4, color: '#E53E3E' },
      ],
    },
    statuses: {
      type: [
        {
          name: String,
          order: Number,
          color: String,
        },
      ],
      default: [
        { name: 'Not Started', order: 0, color: '#A0AEC0' },
        { name: 'On Track', order: 1, color: '#38A169' },
        { name: 'At Risk', order: 2, color: '#ECC94B' },
        { name: 'Delayed', order: 3, color: '#E53E3E' },
        { name: 'Completed', order: 4, color: '#4299E1' },
      ],
    },
  },
  {
    timestamps: true,
  },
);

const PipelineSettings = mongoose.model('PipelineSettings', pipelineSettingsSchema);

export default PipelineSettings;
