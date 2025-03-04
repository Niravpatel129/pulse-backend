import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    jobTitle: {
      type: String,
      trim: true,
    },
    mailingAddress: {
      type: String,
      trim: true,
    },
    comments: {
      type: String,
      trim: true,
    },
    customFields: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
  },
);

const Participant = mongoose.model('Participant', participantSchema);

export default Participant;
