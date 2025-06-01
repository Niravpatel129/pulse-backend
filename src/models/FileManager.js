import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

const fileItemSchema = new mongoose.Schema(
  {
    shortid: {
      type: String,
      default: () => nanoid(10),
      unique: true,
    },
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
    lastAccessed: {
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
      fileExtension: String,
      fileHash: String,
      dimensions: {
        width: Number,
        height: Number,
      },
      duration: Number, // For audio/video files
      thumbnailUrl: String,
      processingStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'completed',
      },
      processingError: String,
      compressionStatus: {
        type: String,
        enum: ['none', 'compressed', 'failed'],
        default: 'none',
      },
      encryptionStatus: {
        type: String,
        enum: ['none', 'encrypted'],
        default: 'none',
      },
      version: {
        type: Number,
        default: 1,
      },
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    workspaceShortid: {
      type: String,
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
    permissions: {
      type: Map,
      of: {
        type: String,
        enum: ['read', 'write', 'admin'],
      },
      default: new Map(),
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
fileItemSchema.index({ 'fileDetails.fileHash': 1 });
fileItemSchema.index({ lastAccessed: 1 });

const FileItem = mongoose.model('FileItem', fileItemSchema);

export default FileItem;
