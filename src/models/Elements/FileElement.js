import mongoose from 'mongoose';

const fileElementSchema = new mongoose.Schema({
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    required: true,
  },
  elementType: {
    type: String,
    default: 'file',
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  files: [
    {
      url: {
        type: String,
        required: true,
      },
      originalName: {
        type: String,
        required: true,
      },
      mimeType: {
        type: String,
        required: true,
      },
      size: {
        type: Number,
        required: true,
      },
      storagePath: {
        type: String,
        required: true,
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const FileElement = mongoose.model('FileElement', fileElementSchema);

export default FileElement;
