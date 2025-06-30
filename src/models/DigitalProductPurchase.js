import mongoose from 'mongoose';

const digitalProductPurchaseSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: function () {
      return new mongoose.Types.ObjectId().toString();
    },
  },
  orderId: {
    type: String,
    required: true,
    unique: true,
  },
  product: {
    type: String,
    ref: 'DigitalProduct',
    required: true,
  },
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
  },
  // Customer information
  customerInfo: {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
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
      default: null,
    },
    company: {
      type: String,
      default: null,
    },
    country: {
      type: String,
      required: true,
    },
    acceptsMarketing: {
      type: Boolean,
      default: false,
    },
  },
  // Payment information
  paymentInfo: {
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
    stripePaymentIntentId: {
      type: String,
      required: true,
    },
    stripeClientSecret: {
      type: String,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'canceled'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      default: null,
    },
  },
  // Download tracking
  downloadInfo: {
    downloadCount: {
      type: Number,
      default: 0,
    },
    firstDownloadAt: {
      type: Date,
      default: null,
    },
    lastDownloadAt: {
      type: Date,
      default: null,
    },
    downloadToken: {
      type: String,
      default: null,
    },
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'refunded', 'failed'],
    default: 'pending',
  },
  metadata: {
    type: Map,
    of: String,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for better query performance
digitalProductPurchaseSchema.index({ workspace: 1, status: 1 });
digitalProductPurchaseSchema.index({ 'customerInfo.email': 1 });
digitalProductPurchaseSchema.index({ 'paymentInfo.stripePaymentIntentId': 1 });
digitalProductPurchaseSchema.index({ orderId: 1 });

// Update the updatedAt field before saving
digitalProductPurchaseSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const DigitalProductPurchase = mongoose.model(
  'DigitalProductPurchase',
  digitalProductPurchaseSchema,
);

export default DigitalProductPurchase;
