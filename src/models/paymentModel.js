import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    method: {
      type: String,
      required: true,
    },
    memo: {
      type: String,
      default: '',
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Track payment sequence
    paymentNumber: {
      type: Number,
      required: true,
    },
    // Track remaining balance after this payment
    remainingBalance: {
      type: Number,
      required: true,
    },
    // Reference to previous payment in sequence
    previousPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    // Payment status
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'completed',
    },
    // Transaction type
    type: {
      type: String,
      enum: ['payment', 'deposit', 'refund', 'adjustment', 'credit'],
      required: true,
      default: 'payment',
    },
    // For deposits and credits, track if they've been applied to any payments
    appliedTo: [
      {
        payment: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Payment',
        },
        amount: Number,
        date: Date,
      },
    ],
    // For refunds, reference the original payment
    refundedPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    // Store complete Stripe payment intent details
    stripePaymentDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Receipt information
    receipt: {
      number: {
        type: String,
        required: true,
        unique: true,
      },
      type: {
        type: String,
        enum: ['payment_receipt', 'deposit_receipt'],
        required: true,
      },
      date: {
        type: Date,
        required: true,
      },
      status: {
        type: String,
        enum: ['generated', 'sent', 'viewed'],
        default: 'generated',
      },
      sentAt: Date,
      viewedAt: Date,
    },
    // Enhanced metadata for better tracking
    metadata: {
      isDeposit: {
        type: Boolean,
        default: false,
      },
      depositPercentage: {
        type: Number,
        default: null,
      },
      depositDueDate: {
        type: Date,
        default: null,
      },
      paymentSequence: {
        number: {
          type: Number,
          required: true,
        },
        total: {
          type: Number,
          required: true,
        },
        isFinal: {
          type: Boolean,
          default: false,
        },
      },
      currency: {
        type: String,
        required: true,
      },
      paymentMethod: {
        type: {
          type: String,
          enum: ['credit_card', 'debit_card', 'bank_transfer', 'cash', 'check', 'other'],
          required: true,
        },
        details: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    },
  },
  {
    timestamps: true,
  },
);

// Add indexes for better query performance
paymentSchema.index({ invoice: 1 });
paymentSchema.index({ workspace: 1 });
paymentSchema.index({ date: 1 });
paymentSchema.index({ paymentNumber: 1 });
paymentSchema.index({ type: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ 'receipt.number': 1 });
paymentSchema.index({ 'metadata.isDeposit': 1 });
paymentSchema.index({ 'metadata.paymentSequence.number': 1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
