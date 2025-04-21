import mongoose from 'mongoose';

const SubmissionSchema = new mongoose.Schema({
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  },
  leadForm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeadForm',
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  clientEmail: String,
  clientName: String,
  clientPhone: String,
  clientCompany: String,
  clientAddress: String,
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  formValues: mongoose.Schema.Types.Mixed,
});

const Submission = mongoose.model('Submission', SubmissionSchema);

export default Submission;
