import mongoose from 'mongoose';

const emailTemplateSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    variables: [
      {
        type: String,
        description: String,
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Add indexes for common queries
emailTemplateSchema.index({ projectId: 1, name: 1 });
emailTemplateSchema.index({ createdBy: 1 });

const EmailTemplate = mongoose.model('EmailTemplate', emailTemplateSchema);

export default EmailTemplate;
