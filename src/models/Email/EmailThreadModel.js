import mongoose from 'mongoose';

// Schema for custom notes/annotations
const threadNoteSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    type: {
      type: String,
      enum: ['note', 'task', 'reminder', 'custom'],
      default: 'note',
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: true },
);

// Schema for thread participants
const threadParticipantSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['sender', 'recipient', 'cc', 'bcc'],
      required: true,
    },
    isInternal: {
      type: Boolean,
      default: false,
    },
    lastInteraction: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

// Schema for thread labels/tags
const threadLabelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      default: '#000000',
    },
    description: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const emailThreadSchema = new mongoose.Schema(
  {
    threadId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
    },
    participants: [threadParticipantSchema],
    emails: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Email',
      },
    ],
    latestMessage: {
      content: {
        type: String,
        default: '',
      },
      sender: {
        type: String,
        default: '',
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
      type: {
        type: String,
        enum: ['email', 'note', 'system'],
        default: 'email',
      },
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    labels: [threadLabelSchema],
    notes: [threadNoteSchema],
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isStarred: {
      type: Boolean,
      default: false,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for common queries
emailThreadSchema.index({ workspaceId: 1, lastActivity: -1 });
emailThreadSchema.index({ workspaceId: 1, status: 1 });
emailThreadSchema.index({ workspaceId: 1, priority: 1 });
emailThreadSchema.index({ workspaceId: 1, isRead: 1 });
emailThreadSchema.index({ workspaceId: 1, isStarred: 1 });
emailThreadSchema.index({ workspaceId: 1, isPinned: 1 });

// Add index for title search
emailThreadSchema.index({ workspaceId: 1, title: 'text' });

// Method to add an email to the thread
emailThreadSchema.methods.addEmail = async function (emailId) {
  if (!this.emails.includes(emailId)) {
    this.emails.push(emailId);
    this.lastActivity = new Date();
    await this.save();
  }
  return this;
};

// Method to add a note to the thread
emailThreadSchema.methods.addNote = async function (noteData) {
  this.notes.push({
    ...noteData,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  this.lastActivity = new Date();
  await this.save();
  return this;
};

// Method to update a note
emailThreadSchema.methods.updateNote = async function (noteId, updateData) {
  const note = this.notes.id(noteId);
  if (note) {
    Object.assign(note, updateData, { updatedAt: new Date() });
    this.lastActivity = new Date();
    await this.save();
  }
  return this;
};

// Method to add a label to the thread
emailThreadSchema.methods.addLabel = async function (labelData) {
  const existingLabel = this.labels.find((l) => l.name === labelData.name);
  if (!existingLabel) {
    this.labels.push({
      ...labelData,
      addedAt: new Date(),
    });
    await this.save();
  }
  return this;
};

// Method to remove a label from the thread
emailThreadSchema.methods.removeLabel = async function (labelName) {
  this.labels = this.labels.filter((l) => l.name !== labelName);
  await this.save();
  return this;
};

// Method to update thread status
emailThreadSchema.methods.updateStatus = async function (status) {
  this.status = status;
  this.lastActivity = new Date();
  await this.save();
  return this;
};

// Method to update thread priority
emailThreadSchema.methods.updatePriority = async function (priority) {
  this.priority = priority;
  this.lastActivity = new Date();
  await this.save();
  return this;
};

// Method to toggle thread star status
emailThreadSchema.methods.toggleStar = async function () {
  this.isStarred = !this.isStarred;
  this.lastActivity = new Date();
  await this.save();
  return this;
};

// Method to toggle thread pin status
emailThreadSchema.methods.togglePin = async function () {
  this.isPinned = !this.isPinned;
  this.lastActivity = new Date();
  await this.save();
  return this;
};

// Method to mark thread as read/unread
emailThreadSchema.methods.markAsRead = async function (isRead = true) {
  this.isRead = isRead;
  this.lastActivity = new Date();
  await this.save();
  return this;
};

// Method to update custom fields
emailThreadSchema.methods.updateCustomFields = async function (fields) {
  Object.assign(this.customFields, fields);
  this.lastActivity = new Date();
  await this.save();
  return this;
};

// Method to update metadata
emailThreadSchema.methods.updateMetadata = async function (metadata) {
  Object.assign(this.metadata, metadata);
  this.lastActivity = new Date();
  await this.save();
  return this;
};

// Method to update latest message
emailThreadSchema.methods.updateLatestMessage = async function (messageData) {
  this.latestMessage = {
    content: messageData.content,
    sender: messageData.sender,
    timestamp: messageData.timestamp || new Date(),
    type: messageData.type || 'email',
  };
  this.lastActivity = messageData.timestamp || new Date();
  await this.save();
  return this;
};

// Static method to find threads by workspace
emailThreadSchema.statics.findByWorkspace = function (workspaceId, query = {}) {
  return this.find({ workspaceId, ...query }).sort({ lastActivity: -1 });
};

// Static method to find unread threads
emailThreadSchema.statics.findUnread = function (workspaceId) {
  return this.find({ workspaceId, isRead: false }).sort({ lastActivity: -1 });
};

// Static method to find starred threads
emailThreadSchema.statics.findStarred = function (workspaceId) {
  return this.find({ workspaceId, isStarred: true }).sort({ lastActivity: -1 });
};

// Static method to find pinned threads
emailThreadSchema.statics.findPinned = function (workspaceId) {
  return this.find({ workspaceId, isPinned: true }).sort({ lastActivity: -1 });
};

// Static method to find threads by priority
emailThreadSchema.statics.findByPriority = function (workspaceId, priority) {
  return this.find({ workspaceId, priority }).sort({ lastActivity: -1 });
};

// Static method to find threads by status
emailThreadSchema.statics.findByStatus = function (workspaceId, status) {
  return this.find({ workspaceId, status }).sort({ lastActivity: -1 });
};

// Static method to find threads by label
emailThreadSchema.statics.findByLabel = function (workspaceId, labelName) {
  return this.find({ workspaceId, 'labels.name': labelName }).sort({ lastActivity: -1 });
};

// Static method to find threads by participant
emailThreadSchema.statics.findByParticipant = function (workspaceId, email) {
  return this.find({ workspaceId, 'participants.email': email }).sort({ lastActivity: -1 });
};

const EmailThread = mongoose.model('EmailThread', emailThreadSchema);

export default EmailThread;
