import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
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
