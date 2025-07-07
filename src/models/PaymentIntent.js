import mongoose from 'mongoose';

const paymentIntentSchema = new mongoose.Schema(
  {
    // Stripe payment intent ID
    stripePaymentIntentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Client secret for frontend payment processing
    clientSecret: {
      type: String,
      required: true,
    },

    // Associated invoice
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice2',
      required: true,
      index: true,
    },

    // Workspace context
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },

    // Payment amount in cents
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Currency code
    currency: {
      type: String,
      required: true,
      default: 'usd',
    },

    // Payment intent status
    status: {
      type: String,
      enum: [
        'requires_payment_method',
        'requires_confirmation',
        'requires_action',
        'processing',
        'requires_capture',
        'canceled',
        'succeeded',
        'failed',
      ],
      required: true,
      default: 'requires_payment_method',
    },

    // Payment type
    paymentType: {
      type: String,
      enum: ['full_payment', 'deposit', 'partial_payment'],
      required: true,
    },

    // Whether this is a deposit payment
    isDeposit: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Deposit percentage if applicable
    depositPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },

    // Stripe connect account used
    stripeConnectAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StripeConnectAccount',
      required: true,
    },

    // Customer information
    customer: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
      },
      name: String,
      email: String,
    },

    // Payment method details (if available)
    paymentMethod: {
      type: {
        type: String,
        enum: ['card', 'bank_transfer', 'sepa_debit', 'ideal', 'sofort', 'bancontact', 'giropay'],
      },
      card: {
        brand: String,
        last4: String,
        expMonth: Number,
        expYear: Number,
        country: String,
      },
      billingDetails: {
        name: String,
        email: String,
        phone: String,
        address: {
          line1: String,
          line2: String,
          city: String,
          state: String,
          postalCode: String,
          country: String,
        },
      },
    },

    // Application fee amount (in cents)
    applicationFeeAmount: {
      type: Number,
      min: 0,
    },

    // Capture method
    captureMethod: {
      type: String,
      enum: ['automatic', 'manual'],
      default: 'automatic',
    },

    // Confirmation method
    confirmationMethod: {
      type: String,
      enum: ['automatic', 'manual'],
      default: 'automatic',
    },

    // Setup future usage
    setupFutureUsage: {
      type: String,
      enum: ['off_session', 'on_session'],
    },

    // Description for the payment intent
    description: String,

    // Metadata
    metadata: {
      type: Map,
      of: String,
      default: {},
    },

    // Receipt email
    receiptEmail: String,

    // Statement descriptor
    statementDescriptor: String,

    // Statement descriptor suffix
    statementDescriptorSuffix: String,

    // Transfer data for connected accounts
    transferData: {
      destination: String,
      amount: Number,
    },

    // Last payment error
    lastPaymentError: {
      type: {
        type: String,
      },
      code: String,
      declineCode: String,
      message: String,
      param: String,
      paymentMethod: {
        type: mongoose.Schema.Types.Mixed,
      },
    },

    // Next action for 3D Secure or other authentication
    nextAction: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Status history for tracking changes
    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        reason: String,
        metadata: {
          type: Map,
          of: String,
        },
      },
    ],

    // Payment attempts tracking
    paymentAttempts: [
      {
        attemptNumber: {
          type: Number,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          required: true,
        },
        error: {
          type: String,
        },
        paymentMethodId: String,
      },
    ],

    // Cancellation details
    canceledAt: Date,
    cancellationReason: {
      type: String,
      enum: ['duplicate', 'fraudulent', 'requested_by_customer', 'abandoned'],
    },

    // Confirmation details
    confirmedAt: Date,
    confirmationMethod: String,

    // Processing details
    processing: {
      type: {
        type: String,
        enum: ['card'],
      },
    },

    // Amount details
    amountDetails: {
      tip: {
        amount: Number,
      },
    },

    // Automatic payment methods
    automaticPaymentMethods: {
      enabled: {
        type: Boolean,
        default: false,
      },
      allowRedirects: {
        type: String,
        enum: ['always', 'never'],
        default: 'always',
      },
    },

    // Created by user
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // IP address of the request
    clientIp: String,

    // User agent
    userAgent: String,

    // Source of the payment intent creation
    source: {
      type: String,
      enum: ['web', 'mobile', 'api', 'admin'],
      default: 'web',
    },

    // Expiration time
    expiresAt: Date,

    // Whether this payment intent has been used
    used: {
      type: Boolean,
      default: false,
    },

    // Related payment record (if payment was successful)
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },

    // Webhook events received for this payment intent
    webhookEvents: [
      {
        eventId: String,
        eventType: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        processed: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes for better query performance
paymentIntentSchema.index({ invoice: 1, status: 1 });
paymentIntentSchema.index({ workspace: 1, createdAt: -1 });
paymentIntentSchema.index({ status: 1, createdAt: -1 });
paymentIntentSchema.index({ 'customer.email': 1 });
paymentIntentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
paymentIntentSchema.index({ used: 1, createdAt: -1 });

// Pre-save middleware to update status history
paymentIntentSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
    });
  }
  next();
});

// Virtual for formatted amount
paymentIntentSchema.virtual('formattedAmount').get(function () {
  return (this.amount / 100).toFixed(2);
});

// Virtual for formatted currency
paymentIntentSchema.virtual('formattedCurrency').get(function () {
  return this.currency.toUpperCase();
});

// Method to add payment attempt
paymentIntentSchema.methods.addPaymentAttempt = function (
  status,
  error = null,
  paymentMethodId = null,
) {
  const attemptNumber = this.paymentAttempts.length + 1;
  this.paymentAttempts.push({
    attemptNumber,
    timestamp: new Date(),
    status,
    error,
    paymentMethodId,
  });
  return this.save();
};

// Method to add webhook event
paymentIntentSchema.methods.addWebhookEvent = function (eventId, eventType) {
  this.webhookEvents.push({
    eventId,
    eventType,
    timestamp: new Date(),
    processed: false,
  });
  return this.save();
};

// Method to mark webhook event as processed
paymentIntentSchema.methods.markWebhookProcessed = function (eventId) {
  const event = this.webhookEvents.find((e) => e.eventId === eventId);
  if (event) {
    event.processed = true;
  }
  return this.save();
};

// Static method to find active payment intents for an invoice
paymentIntentSchema.statics.findActiveForInvoice = function (invoiceId) {
  return this.find({
    invoice: invoiceId,
    status: {
      $in: ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'],
    },
    used: false,
  }).sort({ createdAt: -1 });
};

// Static method to find successful payment intents for an invoice
paymentIntentSchema.statics.findSuccessfulForInvoice = function (invoiceId) {
  return this.find({
    invoice: invoiceId,
    status: 'succeeded',
  }).sort({ createdAt: -1 });
};

const PaymentIntent = mongoose.model('PaymentIntent', paymentIntentSchema);

export default PaymentIntent;
