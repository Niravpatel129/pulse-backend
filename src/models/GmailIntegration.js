import mongoose from 'mongoose';

const GmailIntegrationSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    refreshTokenLastUsedAt: {
      type: Date,
      description: 'Timestamp when the refresh token was last used',
    },
    tokenExpiry: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastSynced: {
      type: Date,
      default: Date.now,
    },
    isPrimary: {
      type: Boolean,
      default: true,
      description: 'Indicates if this is the primary email for the workspace',
    },
    watchExpiration: {
      type: Date,
      description: 'Expiration time for Gmail push notifications watch',
    },
    historyId: {
      type: String,
      description: 'Gmail history ID for tracking changes',
    },
  },
  {
    timestamps: true,
  },
);

// Ensure unique emails per workspace
GmailIntegrationSchema.index({ workspace: 1, email: 1 }, { unique: true });

// Ensure only one primary email per workspace
GmailIntegrationSchema.index(
  { workspace: 1, isPrimary: 1 },
  {
    unique: true,
    partialFilterExpression: { isPrimary: true },
  },
);

const GmailIntegration = mongoose.model('GmailIntegration', GmailIntegrationSchema);

export default GmailIntegration;
