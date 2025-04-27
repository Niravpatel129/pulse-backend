import mongoose from 'mongoose';

const kanbanColumnSchema = new mongoose.Schema(
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
    color: {
      type: String,
      required: true,
      default: '#000000',
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

const KanbanColumn = mongoose.model('KanbanColumn', kanbanColumnSchema);

export default KanbanColumn;
