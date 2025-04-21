import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      default: 'note',
    },
    content: {
      type: String,
      required: true,
    },
    attachments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File',
      },
    ],
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

const Note = mongoose.model('Note', noteSchema);

export default Note;
