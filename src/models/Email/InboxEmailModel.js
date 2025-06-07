import mongoose from 'mongoose';

// Schema for email addresses
const emailAddressSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    card_name: {
      type: String,
      required: true,
    },
    handle: {
      type: String,
      required: true,
    },
    display_name: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      required: true,
    },
    initials: {
      type: String,
      required: true,
    },
    card_id: {
      type: Number,
      required: true,
    },
    card_url: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },
    company: {
      type: String,
      default: null,
    },
    job_title: {
      type: String,
      default: null,
    },
    location: {
      type: String,
      default: null,
    },
    social_profiles: {
      type: Map,
      of: String,
      default: {},
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  { _id: false },
);

// Schema for email body parts
const emailPartSchema = new mongoose.Schema(
  {
    mimeType: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: function () {
        return !this.mimeType.startsWith('multipart/');
      },
    },
    contentId: String,
    filename: String,
    headers: [
      {
        name: String,
        value: String,
      },
    ],
    parts: [
      {
        type: mongoose.Schema.Types.Mixed,
        refPath: 'mimeType',
      },
    ],
  },
  { _id: false },
);

// Schema for attachments
const attachmentSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    attachmentId: {
      type: String,
      required: true,
    },
    storageUrl: {
      type: String,
      required: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    contentId: String,
    position: Number,
    dimensions: {
      width: Number,
      height: Number,
    },
    headers: [
      {
        name: String,
        value: String,
      },
    ],
    thumbnail: {
      url: String,
      path: String,
      width: Number,
      height: Number,
      generatedAt: Date,
    },
  },
  { _id: false },
);

const inboxEmailSchema = new mongoose.Schema(
  {
    threadId: {
      type: String,
      required: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    gmailMessageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    from: {
      type: emailAddressSchema,
      required: true,
    },
    to: [emailAddressSchema],
    cc: [emailAddressSchema],
    bcc: [emailAddressSchema],
    subject: {
      type: String,
      required: true,
    },
    body: {
      mimeType: {
        type: String,
        required: true,
        default: 'multipart/alternative',
      },
      parts: [emailPartSchema],
      structure: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
      },
    },
    attachments: [attachmentSchema],
    inlineImages: [attachmentSchema],
    historyId: {
      type: String,
      required: true,
    },
    internalDate: {
      type: Date,
      required: true,
    },
    snippet: {
      type: String,
      default: '',
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true,
    },
    status: {
      type: String,
      enum: ['received', 'sent', 'draft', 'failed'],
      required: true,
    },
    sentAt: {
      type: Date,
      required: true,
    },
    isSpam: {
      type: Boolean,
      default: false,
    },
    stage: {
      type: String,
      enum: ['unassigned', 'assigned', 'archived', 'snoozed', 'trash', 'spam'],
      default: 'unassigned',
    },
    messageReferences: [
      {
        messageId: String,
        inReplyTo: String,
        references: [String],
        type: {
          type: String,
          enum: ['reply', 'forward', 'original'],
          default: 'original',
        },
        position: Number,
      },
    ],
    labels: [
      {
        name: String,
        color: String,
      },
    ],
    headers: [
      {
        name: String,
        value: String,
      },
    ],
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  },
);

// Indexes for common queries
inboxEmailSchema.index({ userId: 1, internalDate: -1 });
inboxEmailSchema.index({ threadId: 1, sentAt: -1 });
inboxEmailSchema.index({ workspaceId: 1, stage: 1 });
inboxEmailSchema.index({ workspaceId: 1, isSpam: 1 });

// Method to mark email as read
inboxEmailSchema.methods.markAsRead = async function (userId) {
  if (!this.readBy.includes(userId)) {
    this.readBy.push(userId);
    await this.save();
  }
  return this;
};

// Method to mark email as unread
inboxEmailSchema.methods.markAsUnread = async function (userId) {
  this.readBy = this.readBy.filter((id) => id.toString() !== userId.toString());
  await this.save();
  return this;
};

// Method to add label
inboxEmailSchema.methods.addLabel = async function (label) {
  if (!this.labels.some((l) => l.name === label.name)) {
    this.labels.push(label);
    await this.save();
  }
  return this;
};

// Method to remove label
inboxEmailSchema.methods.removeLabel = async function (labelName) {
  this.labels = this.labels.filter((l) => l.name !== labelName);
  await this.save();
  return this;
};

// Static method to find emails in a thread
inboxEmailSchema.statics.findThread = function (threadId) {
  return this.find({ threadId }).sort({ sentAt: 1 });
};

// Static method to find unread emails for a user
inboxEmailSchema.statics.findUnread = function (userId) {
  return this.find({ userId, readBy: { $ne: userId } }).sort({ internalDate: -1 });
};

const InboxEmail = mongoose.model('InboxEmail', inboxEmailSchema);

export default InboxEmail;
