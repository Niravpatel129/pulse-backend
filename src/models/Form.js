import mongoose from 'mongoose';

const formSchema = new mongoose.Schema(
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
    fields: [
      {
        label: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ['text', 'number', 'email', 'date', 'select', 'checkbox', 'file', 'textarea'],
          required: true,
        },
        required: {
          type: Boolean,
          default: false,
        },
        options: [String], // For select/checkbox fields
        placeholder: String,
        default: mongoose.Schema.Types.Mixed,
      },
    ],
    shareableLink: String,
    expiresAt: Date,
    submissions: [
      {
        submittedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        clientEmail: String, // For non-registered users
        submittedAt: {
          type: Date,
          default: Date.now,
        },
        responses: mongoose.Schema.Types.Mixed,
      },
    ],
    notifyOnSubmission: {
      type: Boolean,
      default: true,
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

const Form = mongoose.model('Form', formSchema);

export default Form;
