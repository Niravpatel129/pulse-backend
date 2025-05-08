import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    type: {
      type: String,
      required: true,
      enum: ['project', 'meeting', 'task', 'document', 'comment', 'invoice', 'other'],
    },
    action: {
      type: String,
      required: true,
      enum: [
        'created',
        'updated',
        'deleted',
        'commented',
        'assigned',
        'completed',
        'paid',
        'sent',
        'overdue',
      ],
    },
    description: {
      type: String,
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ['project', 'task', 'document', 'comment', 'invoice', 'payment'],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
activitySchema.index({ user: 1, workspace: 1, createdAt: -1 });
activitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

const Activity = mongoose.model('Activity', activitySchema);

export default Activity;
