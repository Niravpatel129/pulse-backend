import mongoose from 'mongoose';

const stripeConnectAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    accountId: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['express', 'standard'],
      default: 'express',
    },
    chargesEnabled: {
      type: Boolean,
      default: false,
    },
    payoutsEnabled: {
      type: Boolean,
      default: false,
    },
    detailsSubmitted: {
      type: Boolean,
      default: false,
    },
    requirements: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      default: 'pending',
    },
  },
  {
    timestamps: true,
  },
);

const StripeConnectAccount = mongoose.model('StripeConnectAccount', stripeConnectAccountSchema);

export default StripeConnectAccount;
