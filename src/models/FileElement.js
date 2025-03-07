import mongoose from 'mongoose';
import Element from './Element.js';

const fileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['document', 'image', 'other'],
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  firebaseUrl: {
    type: String,
    required: true,
  },
  storagePath: {
    type: String,
    required: true, // Firebase storage path for deletion
  },
  contentType: String,
  thumbnailUrl: String, // For images or documents that have thumbnails
  comment: String,
  uploadedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map(),
  },
});

// Create FileElement as a discriminator of Element
const FileElement = Element.discriminator(
  'FileElement',
  new mongoose.Schema({
    files: [fileSchema],
    totalSize: {
      type: Number,
      default: 0, // Total size of all files in bytes
    },
  }),
);

// Pre-save middleware to update totalSize
FileElement.schema.pre('save', function (next) {
  if (this.files && this.files.length > 0) {
    this.totalSize = this.files.reduce((total, file) => total + (file.size || 0), 0);
  }
  next();
});

export default FileElement;
