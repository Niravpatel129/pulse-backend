import mongoose from 'mongoose';

const rowSchema = new mongoose.Schema(
  {
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      required: true,
    },
    position: {
      type: Number,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient querying and sorting
rowSchema.index({ tableId: 1, position: 1 });
rowSchema.index({ tableId: 1, createdAt: -1 });

const Row = mongoose.model('Row', rowSchema);

export default Row;
