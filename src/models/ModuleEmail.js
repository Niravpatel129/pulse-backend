import mongoose from 'mongoose';

const moduleEmailSchema = new mongoose.Schema({
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    required: true,
    index: true,
  },
  subject: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
  recipientEmail: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['awaiting_approval', 'approved', 'rejected', 'not_seen'],
    default: 'not_seen',
  },
  requestApproval: {
    type: Boolean,
    default: false,
  },
  approvedAt: {
    type: Date,
  },
  approvalResponse: {
    type: String,
  },
});

// Add indexes for common queries
moduleEmailSchema.index({ moduleId: 1, sentAt: -1 });
moduleEmailSchema.index({ status: 1 });

const ModuleEmail = mongoose.model('ModuleEmail', moduleEmailSchema);
export default ModuleEmail;
