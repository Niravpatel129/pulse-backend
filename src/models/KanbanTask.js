import mongoose from 'mongoose';

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
  },
  {
    timestamps: true,
  },
);

const KanbanTask = mongoose.model('KanbanTask', kanbanTaskSchema);

export default KanbanTask;
