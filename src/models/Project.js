import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    projectType: {
      type: String,
      required: true,
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    leadSource: {
      type: String,
    },
    stage: {
      type: String,
      required: true,
      default: 'Initial Contact',
    },
    status: {
      type: String,
      required: true,
      default: 'planning',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: {
          type: String,
          required: true,
          default: 'participant',
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

const Project = mongoose.model('Project', projectSchema);

export default Project;
