import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    logo: {
      type: String,
      default: '',
    },
    subdomain: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    customDomains: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    clients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
      },
    ],
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          required: true,
          enum: ['owner', 'admin', 'moderator', 'client'],
          default: 'client',
        },
      },
    ],
    invitations: [
      {
        email: {
          type: String,
          required: true,
        },
        role: {
          type: String,
          required: true,
          enum: ['owner', 'admin', 'moderator', 'client'],
          default: 'client',
        },
        token: {
          type: String,
          required: true,
        },
        invitedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        expiresAt: {
          type: Date,
          required: true,
        },
      },
    ],
    invoiceSettings: {
      type: Object,
      default: {},
    },
    settings: {
      allowMemberInvites: {
        type: Boolean,
        default: true,
      },
      defaultProjectVisibility: {
        type: String,
        enum: ['private', 'public'],
        default: 'private',
      },
    },
  },
  {
    timestamps: true,
  },
);

const Workspace = mongoose.model('Workspace', workspaceSchema);

export default Workspace;
