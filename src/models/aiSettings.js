import mongoose from 'mongoose';

const aiSettingsSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    knowledgePrompt: {
      type: String,
      default: '',
    },
    model: {
      type: String,
      enum: ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet'],
      default: 'gpt-3.5-turbo',
    },
    temperature: {
      type: Number,
      min: 0,
      max: 2,
      default: 0.7,
    },
    maxTokens: {
      type: Number,
      min: 1,
      max: 32000,
      default: 2000,
    },
    systemPrompt: {
      type: String,
      default: '',
    },
    enabledFeatures: {
      documentAnalysis: {
        type: Boolean,
        default: true,
      },
      codeAnalysis: {
        type: Boolean,
        default: true,
      },
      chat: {
        type: Boolean,
        default: true,
      },
    },
    customInstructions: {
      type: String,
      default: '',
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Create compound index for workspaceId
aiSettingsSchema.index({ workspaceId: 1 }, { unique: true });

const AISettings = mongoose.model('AISettings', aiSettingsSchema);

export default AISettings;
