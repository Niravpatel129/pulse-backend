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
    shippingAddress: {
      fullName: {
        type: String,
        trim: true,
      },
      streetAddress1: {
        type: String,
        trim: true,
      },
      streetAddress2: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      state: {
        type: String,
        trim: true,
      },
      postalCode: {
        type: String,
        trim: true,
      },
      country: {
        type: String,
        trim: true,
      },
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
    company: {
      type: String,
      trim: true,
    },
    workspaces: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true,
      },
    ],
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

const Participant = mongoose.model('Participant', participantSchema);

export default Participant;
