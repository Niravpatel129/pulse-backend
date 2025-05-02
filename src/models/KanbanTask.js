import mongoose from 'mongoose';

// Comment schema
const commentSchema = new mongoose.Schema(
  {
    author: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      avatar: String,
    },
    content: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

// Attachment schema
const attachmentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    size: Number,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      name: String,
      avatar: String,
    },
  },
  { _id: true },
);

// Time entry schema
const timeEntrySchema = new mongoose.Schema(
  {
    hours: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
    },
    user: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      name: String,
      avatar: String,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    isBillable: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true },
);

const kanbanTaskSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    columnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KanbanColumn',
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    assignee: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      name: String,
      avatar: String,
    },
    reporter: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      name: String,
      avatar: String,
    },
    description: {
      type: String,
    },
    dueDate: {
      type: Date,
    },
    labels: [String],
    storyPoints: {
      type: Number,
    },
    position: {
      type: Number,
      default: 0,
    },
    _archived: {
      type: Boolean,
      default: false,
    },
    _deleted: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
    },
    comments: [commentSchema],
    attachments: [attachmentSchema],
    timeEntries: [timeEntrySchema],
    totalHours: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Pre-save middleware to update totalHours
kanbanTaskSchema.pre('save', function (next) {
  if (this.timeEntries && this.timeEntries.length > 0) {
    this.totalHours = this.timeEntries.reduce((total, entry) => total + (entry.hours || 0), 0);
  } else {
    this.totalHours = 0;
  }
  next();
});

const KanbanTask = mongoose.model('KanbanTask', kanbanTaskSchema);

export default KanbanTask;
