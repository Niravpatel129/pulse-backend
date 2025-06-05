import crypto from 'crypto';
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

// Add schema for message references
const messageReferenceSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
    },
    inReplyTo: {
      type: String,
      default: null,
    },
    references: [
      {
        type: String,
        default: [],
      },
    ],
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
    stage: {
      type: String,
      enum: ['unassigned', 'assigned', 'archived', 'snoozed', 'trash', 'spam'],
      default: 'unassigned',
    },
    subject: {
      type: String,
      required: true,
    },
    cleanSubject: {
      type: String,
      required: true,
      index: true,
    },
    participants: [threadParticipantSchema],
    emails: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Email',
      },
    ],
    messageReferences: [messageReferenceSchema],
    participantHash: {
      type: String,
      required: true,
      index: true,
    },
    firstMessageDate: {
      type: Date,
      required: true,
    },
    lastMessageDate: {
      type: Date,
      required: true,
    },
    messageCount: {
      type: Number,
      default: 1,
    },
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
      isRead: {
        type: Boolean,
        default: false,
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

// Method to mark latest message as read
emailThreadSchema.methods.markLatestMessageAsRead = async function (isRead = true) {
  if (this.latestMessage) {
    this.latestMessage.isRead = isRead;
    this.lastActivity = new Date();
    await this.save();
  }
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
    isRead: messageData.isRead ?? false,
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

// Move cleanSubjectFromSubject to be a static method
emailThreadSchema.statics.cleanSubjectFromSubject = function (subject) {
  return subject
    .replace(/^(Re|Fwd|Fw|R|F):\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Add method to get all participant emails from an email
emailThreadSchema.statics.getParticipantEmails = function (email) {
  const participants = new Set();

  if (email.from?.email) participants.add(email.from.email);
  if (email.to) email.to.forEach((t) => t.email && participants.add(t.email));
  if (email.cc) email.cc.forEach((c) => c.email && participants.add(c.email));
  if (email.bcc) email.bcc.forEach((b) => b.email && participants.add(b.email));

  return Array.from(participants);
};

// Add method to generate participant hash
emailThreadSchema.statics.generateParticipantHash = function (participants) {
  const sortedEmails = participants
    .filter((p) => p && p.email) // Filter out null/undefined participants and those without email
    .map((p) => p.email.toLowerCase())
    .sort()
    .join('|');
  return crypto.createHash('sha256').update(sortedEmails).digest('hex');
};

// Add static method to find potential thread matches
emailThreadSchema.statics.findPotentialThreads = async function (email) {
  if (!email || !email.subject) {
    return [];
  }

  const cleanSubject = this.cleanSubjectFromSubject(email.subject);
  const participantEmails = this.getParticipantEmails(email);

  if (!participantEmails || participantEmails.length === 0) {
    return [];
  }

  const participantHash = this.generateParticipantHash(
    participantEmails.map((email) => ({ email })),
  );

  // Find threads with matching subject and significant participant overlap
  return this.find({
    cleanSubject,
    participantHash,
    workspaceId: email.workspaceId,
    status: 'active',
  });
};

// Add method to check if email belongs to this thread
emailThreadSchema.methods.shouldIncludeEmail = function (email) {
  // 1. First check Message-ID - if this email's ID is already in the thread
  if (email.messageId && this.messageReferences.some((ref) => ref.messageId === email.messageId)) {
    return true;
  }

  // 2. Check In-Reply-To - if this email is replying to any message in the thread
  if (email.inReplyTo && this.messageReferences.some((ref) => ref.messageId === email.inReplyTo)) {
    return true;
  }

  // 3. Check References - if this email references any message in the thread
  if (
    email.references &&
    email.references.some((ref) =>
      this.messageReferences.some((threadRef) => threadRef.messageId === ref),
    )
  ) {
    return true;
  }

  // 4. Check if any message in the thread references this email
  if (
    email.messageId &&
    this.messageReferences.some((ref) => ref.references && ref.references.includes(email.messageId))
  ) {
    return true;
  }

  // If we get here, the core headers didn't establish a connection
  // Only use heuristics if we have no header-based connection

  // Check participant overlap only if we have no header-based connection
  const emailParticipants = EmailThread.getParticipantEmails(email);
  const threadParticipants = this.participants.map((p) => p.email);
  const overlap = emailParticipants.filter((email) => threadParticipants.includes(email));
  const overlapPercentage =
    overlap.length / Math.max(emailParticipants.length, threadParticipants.length);

  // Require very high participant overlap (>90%) for heuristic matching
  if (overlapPercentage < 0.9) {
    return false;
  }

  // Check time proximity (if more than 24 hours apart, likely new thread)
  const timeDiff = Math.abs(new Date(email.sentAt) - this.firstMessageDate);
  if (timeDiff > 24 * 60 * 60 * 1000) {
    // 24 hours
    return false;
  }

  // Check if this is a new conversation starter
  // If the email doesn't have In-Reply-To or References, and no message in the thread
  // references it, it's likely a new conversation
  if (!email.inReplyTo && (!email.references || email.references.length === 0)) {
    const isReferencedInThread = this.messageReferences.some(
      (ref) => ref.references && ref.references.includes(email.messageId),
    );
    if (!isReferencedInThread) {
      return false;
    }
  }

  // Check if the email is from a mailing list or automated system
  // These often reuse subjects but should be separate threads
  const isAutomated =
    email.from?.email?.toLowerCase().includes('noreply') ||
    email.from?.email?.toLowerCase().includes('no-reply') ||
    email.from?.email?.toLowerCase().includes('automated') ||
    email.from?.email?.toLowerCase().includes('mailing-list') ||
    email.from?.email?.toLowerCase().includes('newsletter');

  if (isAutomated) {
    return false;
  }

  // Only use subject matching as a last resort, and require exact match
  const emailCleanSubject = EmailThread.cleanSubjectFromSubject(email.subject);
  if (emailCleanSubject !== this.cleanSubject) {
    return false;
  }

  // Additional check: If the email has a different threadId from Gmail,
  // it's likely a separate thread even if other heuristics match
  if (email.threadId && email.threadId !== this.threadId) {
    return false;
  }

  return true;
};

// Add method to merge threads
emailThreadSchema.methods.mergeThread = async function (otherThread) {
  // Merge emails
  this.emails = [...new Set([...this.emails, ...otherThread.emails])];

  // Merge participants
  const allParticipants = [...this.participants];
  otherThread.participants.forEach((p) => {
    if (!allParticipants.some((existing) => existing.email === p.email)) {
      allParticipants.push(p);
    }
  });
  this.participants = allParticipants;

  // Update participant hash
  this.participantHash = EmailThread.generateParticipantHash(allParticipants);

  // Merge message references
  this.messageReferences = [...this.messageReferences, ...otherThread.messageReferences];

  // Update dates
  this.firstMessageDate = Math.min(this.firstMessageDate, otherThread.firstMessageDate);
  this.lastMessageDate = Math.max(this.lastMessageDate, otherThread.lastMessageDate);

  // Update message count
  this.messageCount = this.emails.length;

  // Update latest message if other thread's is newer
  if (otherThread.latestMessage.timestamp > this.latestMessage.timestamp) {
    this.latestMessage = otherThread.latestMessage;
  }

  await this.save();
  return this;
};

const EmailThread = mongoose.model('EmailThread', emailThreadSchema);

export default EmailThread;
