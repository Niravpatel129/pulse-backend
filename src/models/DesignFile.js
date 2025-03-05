import mongoose from 'mongoose';

const designFileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileType: String,
    size: Number, // in bytes
    thumbnailUrl: String,
    version: {
      type: Number,
      default: 1,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'revision_requested'],
      default: 'pending',
    },
    approvalFeedback: String,
    history: [
      {
        version: Number,
        fileUrl: String,
        thumbnailUrl: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        uploadedAt: Date,
        notes: String,
      },
    ],
    metadata: {
      dimensions: String,
      resolution: String,
      colorProfile: String,
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

const DesignFile = mongoose.model('DesignFile', designFileSchema);
