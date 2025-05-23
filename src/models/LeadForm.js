import mongoose from 'mongoose';

const formElementSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    required: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    showWhen: {
      type: String,
      default: 'all',
    },
    options: [String],
    clientFields: {
      email: {
        type: Boolean,
        default: true,
      },
      name: {
        type: Boolean,
        default: false,
      },
      phone: {
        type: Boolean,
        default: false,
      },
      address: {
        type: Boolean,
        default: false,
      },
      company: {
        type: Boolean,
        default: false,
      },
      custom: [String],
    },
    defaultValue: mongoose.Schema.Types.Mixed,
    conditions: [
      {
        id: String,
        sourceElementId: String,
        operator: String,
        value: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  { _id: false },
);

const automationSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false },
);

const leadFormSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    elements: [formElementSchema],
    automations: [automationSchema],
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    shareableLink: String,
    embedCode: String,
    notifyOnSubmission: {
      type: Boolean,
      default: true,
    },
    notificationEmails: [String],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    submissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Submission',
      },
    ],
  },
  {
    timestamps: true,
  },
);

const LeadForm = mongoose.model('LeadForm', leadFormSchema);

export default LeadForm;
