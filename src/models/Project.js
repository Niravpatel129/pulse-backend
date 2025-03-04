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
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  },
);

const Project = mongoose.model('Project', projectSchema);

export default Project;
