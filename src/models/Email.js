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
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
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
    attachments: [attachmentSchema],
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'draft'],
      default: 'sent',
    },
  },
  {
    timestamps: true,
  },
);

// Add indexes for common queries
emailSchema.index({ projectId: 1, sentAt: -1 });
emailSchema.index({ sentBy: 1, sentAt: -1 });

const Email = mongoose.model('Email', emailSchema);

export default Email;
