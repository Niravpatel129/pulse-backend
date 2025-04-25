import mongoose from 'mongoose';

const projectAlertSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    type: {
      type: String,
      enum: ['inactivity', 'overdue', 'missing_tasks', 'reminder'],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    remindAt: {
      type: Date,
    },
    isDismissed: {
      type: Boolean,
      default: false,
    },
    isVisibleAlert: {
      type: Boolean,
      default: true,
      description: 'Whether this should display as a full alert (true) or just as a badge (false)',
    },
    resolvedAt: {
      type: Date,
    },
    createdBySystem: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

const ProjectAlert = mongoose.model('ProjectAlert', projectAlertSchema);

export default ProjectAlert;
