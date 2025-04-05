import mongoose from 'mongoose';

const moduleApprovalSchema = new mongoose.Schema(
  {
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectModule',
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approverEmail: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    allowComments: {
      type: Boolean,
      default: true,
    },
    moduleDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sendReminder: {
      type: Boolean,
      default: false,
    },
    approvedAt: {
      type: Date,
    },
    approvalResponse: {
      type: String,
    },
    timeline: [
      {
        action: {
          type: String,
          required: true,
          enum: ['requested', 'approved', 'rejected', 'commented'],
        },
        description: {
          type: String,
          required: true,
        },
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        guestInfo: {
          name: String,
          email: String,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

const ModuleApproval = mongoose.model('ModuleApproval', moduleApprovalSchema);

export default ModuleApproval;
