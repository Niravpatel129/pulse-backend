import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    name: String,
    size: Number,
    type: String,
    url: String,
  },
  { _id: false },
);

const emailSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: function () {
        return this.direction === 'outbound';
      },
    },
    shortEmailId: {
      type: String,
    },
    replyEmailId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Email',
    },
    subject: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    bodyText: {
      type: String,
    },
    to: [
      {
        type: String,
        required: true,
      },
    ],
    cc: [
      {
        type: String,
      },
    ],
    bcc: [
      {
        type: String,
      },
    ],
    from: {
      type: String,
      required: true,
    },
    attachments: [attachmentSchema],
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        return this.direction === 'outbound';
      },
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'draft', 'received'],
      default: 'sent',
    },

    trackingAddress: {
      type: String,
    },

    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    direction: {
      type: String,
      enum: ['outbound', 'inbound'],
      required: true,
      default: 'outbound',
    },
    openedAt: Date,
    openCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Add indexes for common queries
emailSchema.index({ projectId: 1, sentAt: -1 });
emailSchema.index({ sentBy: 1, sentAt: -1 });
emailSchema.index({ threadId: 1, sentAt: -1 });
emailSchema.index({ messageId: 1 });
emailSchema.index({ trackingAddress: 1 });
emailSchema.index({ 'trackingData.shortProjectId': 1 });
emailSchema.index({ 'trackingData.shortThreadId': 1 });
emailSchema.index({ 'trackingData.shortUserId': 1 });
emailSchema.index({ unmatched: 1, createdAt: -1 });

const Email = mongoose.model('Email', emailSchema);

export default Email;
