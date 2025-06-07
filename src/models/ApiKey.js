import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const apiKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: () => uuidv4().replace(/-/g, ''),
      unique: true,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Workspace',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    permissions: {
      type: [String],
      default: ['invoice:read', 'invoice:create'],
    },
    lastUsed: {
      type: Date,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Create indexes
apiKeySchema.index({ workspaceId: 1 });

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

export default ApiKey;
