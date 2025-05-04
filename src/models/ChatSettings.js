import mongoose from 'mongoose';

const ChatSettingsSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    contextSettings: {
      type: String,
      default: '',
      description:
        'Custom context provided by the user to override or augment AI behavior. This can be used to provide specific instructions, domain knowledge, or personal preferences that will be included in every prompt.',
    },
    webSearchEnabled: {
      type: Boolean,
      default: true,
    },
    selectedStyle: {
      type: String,
      enum: ['default', 'professional', 'friendly', 'technical', 'creative'],
      default: 'default',
    },
    selectedModel: {
      type: String,
      enum: ['gpt-4', 'gpt-3.5', 'claude-3-opus', 'claude-3-sonnet', 'gemini-pro'],
      default: 'gpt-4',
    },
    gmailConnected: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Create unique compound index for workspace
ChatSettingsSchema.index({ workspace: 1 }, { unique: true });

const ChatSettings = mongoose.model('ChatSettings', ChatSettingsSchema);

export default ChatSettings;
