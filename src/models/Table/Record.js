import mongoose from 'mongoose';

// Records schema (separate collection to handle potentially large datasets)
const recordSchema = new mongoose.Schema(
  {
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      required: true,
    },
    values: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map(),
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

// Indexes
recordSchema.index({ tableId: 1 });

const Record = mongoose.model('Record', recordSchema);

export default Record;
