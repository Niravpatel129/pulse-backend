import mongoose from 'mongoose';

const stripeTerminalReaderSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    stripeAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StripeConnectAccount',
      required: true,
      index: true,
    },
    accountId: {
      type: String,
      required: true,
      index: true,
    },
    readerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
    },
    deviceType: {
      type: String,
      enum: ['bbpos_wisepos_e', 'verifone_P400', 'stripe_m2', 'wisecube', 'wisepos_e'],
    },
    locationId: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'error', 'pending', 'registered'],
      default: 'pending',
    },
    ipAddress: {
      type: String,
    },
    serialNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastUsedAt: {
      type: Date,
    },
    firmwareVersion: {
      type: String,
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for common queries
stripeTerminalReaderSchema.index({ workspace: 1, status: 1 });
stripeTerminalReaderSchema.index({ workspace: 1, lastSeenAt: -1 });
stripeTerminalReaderSchema.index({ accountId: 1, status: 1 });

// Virtual for reader age
stripeTerminalReaderSchema.virtual('age').get(function () {
  return Date.now() - this.createdAt;
});

// Method to check if reader is online
stripeTerminalReaderSchema.methods.isOnline = function () {
  return this.status === 'online';
};

// Method to check if reader needs attention
stripeTerminalReaderSchema.methods.needsAttention = function () {
  return (
    this.status === 'error' ||
    (this.status === 'offline' && Date.now() - this.lastSeenAt > 24 * 60 * 60 * 1000)
  );
};

const StripeTerminalReader = mongoose.model('StripeTerminalReader', stripeTerminalReaderSchema);

export default StripeTerminalReader;
