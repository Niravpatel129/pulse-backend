import mongoose from 'mongoose';

const fileItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['folder', 'file'],
      required: true,
    },
    size: {
      type: String,
    },
    items: {
      type: Number,
      default: 0,
    },
    lastModified: {
      type: Date,
      default: Date.now,
    },
    children: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FileItem',
      },
    ],
    fileDetails: {
      storagePath: String,
      downloadURL: String,
      contentType: String,
      originalName: String,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    section: {
      type: String,
      enum: ['workspace', 'private'],
      required: true,
    },
    path: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'deleted'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better query performance
fileItemSchema.index({ workspaceId: 1, section: 1 });
fileItemSchema.index({ path: 1 });
fileItemSchema.index({ status: 1 });

const FileItem = mongoose.model('FileItem', fileItemSchema);

export default FileItem;
