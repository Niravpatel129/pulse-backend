import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
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
      default: 'Other',
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
    collaborators: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        id: {
          type: String,
        },
        name: {
          type: String,
          trim: true,
        },
        role: {
          type: String,
          required: true,
        },
        email: {
          type: String,
          trim: true,
        },
        phone: {
          type: String,
        },
        mailingAddress: {
          type: String,
        },
        companyName: {
          type: String,
        },
        companyType: {
          type: String,
        },
        companyWebsite: {
          type: String,
        },
        status: {
          type: String,
          default: 'pending',
        },
        permissions: {
          type: Array,
          default: [],
        },
        dateAdded: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    participants: [
      {
        participant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Participant',
          required: true,
        },
      },
    ],
    team: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
    tasks: [
      {
        title: {
          type: String,
          required: true,
        },
        description: {
          type: String,
        },
        dueDate: {
          type: Date,
        },
        status: {
          type: String,
          enum: ['pending', 'in-progress', 'completed'],
          default: 'pending',
        },
        assignedTo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
    notes: [
      {
        content: {
          type: String,
          required: true,
        },
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
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
