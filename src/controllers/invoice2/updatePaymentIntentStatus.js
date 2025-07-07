import asyncHandler from '../../middleware/asyncHandler.js';
import PaymentIntent from '../../models/PaymentIntent.js';
import Payment from '../../models/paymentModel.js';

// @desc    Update payment intent status (for webhooks)
// @route   POST /api/invoices2/payment-intent/:id/status
// @access  Private
export const updatePaymentIntentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reason, metadata, webhookEventId, webhookEventType } = req.body;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Payment intent ID is required',
    });
  }

  // Find the payment intent
  const paymentIntent = await PaymentIntent.findOne({
    $or: [{ stripePaymentIntentId: id }, { _id: id }],
  }).populate('invoice workspace');

  if (!paymentIntent) {
    return res.status(404).json({
      success: false,
      message: 'Payment intent not found',
    });
  }

  // Update status
  if (status && status !== paymentIntent.status) {
    paymentIntent.status = status;

    // Add to status history
    paymentIntent.statusHistory.push({
      status,
      timestamp: new Date(),
      reason: reason || 'Status updated via webhook',
      metadata: metadata || {},
    });

    // Handle specific status changes
    if (status === 'succeeded') {
      paymentIntent.used = true;

      // Create payment record
      const payment = new Payment({
        invoice: paymentIntent.invoice._id,
        amount: paymentIntent.amount / 100, // Convert from cents
        date: new Date(),
        method: 'stripe',
        memo: `Payment via Stripe - ${paymentIntent.paymentType}`,
        workspace: paymentIntent.workspace._id,
        createdBy: paymentIntent.createdBy,
        paymentNumber: 1, // This should be calculated based on existing payments
        remainingBalance: 0, // This should be calculated
        status: 'completed',
        type: paymentIntent.isDeposit ? 'deposit' : 'payment',
        stripePaymentDetails: {
          paymentIntentId: paymentIntent.stripePaymentIntentId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          paymentMethod: paymentIntent.paymentMethod,
        },
        receipt: {
          number: `RCP-${Date.now()}`,
          type: paymentIntent.isDeposit ? 'deposit_receipt' : 'payment_receipt',
          date: new Date(),
          status: 'generated',
        },
        metadata: {
          isDeposit: paymentIntent.isDeposit,
          depositPercentage: paymentIntent.depositPercentage,
          currency: paymentIntent.currency,
          paymentMethod: {
            type: 'credit_card',
            details: paymentIntent.paymentMethod || {},
          },
        },
      });

      await payment.save();
      paymentIntent.payment = payment._id;
    }

    if (status === 'canceled') {
      paymentIntent.canceledAt = new Date();
      paymentIntent.cancellationReason = metadata?.cancellationReason || 'requested_by_customer';
    }

    if (status === 'requires_action') {
      paymentIntent.nextAction = metadata?.nextAction || {};
    }
  }

  // Add webhook event if provided
  if (webhookEventId && webhookEventType) {
    paymentIntent.addWebhookEvent(webhookEventId, webhookEventType);
  }

  await paymentIntent.save();

  res.status(200).json({
    success: true,
    data: paymentIntent,
  });
});

// @desc    Get payment intent details
// @route   GET /api/invoices2/payment-intent/:id
// @access  Private
export const getPaymentIntent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const paymentIntent = await PaymentIntent.findOne({
    $or: [{ stripePaymentIntentId: id }, { _id: id }],
  }).populate('invoice workspace customer.id');

  if (!paymentIntent) {
    return res.status(404).json({
      success: false,
      message: 'Payment intent not found',
    });
  }

  res.status(200).json({
    success: true,
    data: paymentIntent,
  });
});

// @desc    Get all payment intents for an invoice
// @route   GET /api/invoices2/:invoiceId/payment-intents
// @access  Private
export const getPaymentIntentsForInvoice = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;
  const { status, limit = 50, page = 1 } = req.query;

  const query = { invoice: invoiceId };
  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const paymentIntents = await PaymentIntent.find(query)
    .populate('customer.id')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await PaymentIntent.countDocuments(query);

  res.status(200).json({
    success: true,
    data: paymentIntents,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// @desc    Cancel a payment intent
// @route   POST /api/invoices2/payment-intent/:id/cancel
// @access  Private
export const cancelPaymentIntent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const paymentIntent = await PaymentIntent.findOne({
    $or: [{ stripePaymentIntentId: id }, { _id: id }],
  });

  if (!paymentIntent) {
    return res.status(404).json({
      success: false,
      message: 'Payment intent not found',
    });
  }

  if (paymentIntent.status === 'succeeded') {
    return res.status(400).json({
      success: false,
      message: 'Cannot cancel a successful payment intent',
    });
  }

  if (paymentIntent.status === 'canceled') {
    return res.status(400).json({
      success: false,
      message: 'Payment intent is already canceled',
    });
  }

  // Update status to canceled
  paymentIntent.status = 'canceled';
  paymentIntent.canceledAt = new Date();
  paymentIntent.cancellationReason = reason || 'requested_by_customer';

  paymentIntent.statusHistory.push({
    status: 'canceled',
    timestamp: new Date(),
    reason: reason || 'Payment intent canceled',
  });

  await paymentIntent.save();

  res.status(200).json({
    success: true,
    data: paymentIntent,
  });
});

// @desc    Add payment attempt to payment intent
// @route   POST /api/invoices2/payment-intent/:id/attempt
// @access  Private
export const addPaymentAttempt = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, error, paymentMethodId } = req.body;

  const paymentIntent = await PaymentIntent.findOne({
    $or: [{ stripePaymentIntentId: id }, { _id: id }],
  });

  if (!paymentIntent) {
    return res.status(404).json({
      success: false,
      message: 'Payment intent not found',
    });
  }

  await paymentIntent.addPaymentAttempt(status, error, paymentMethodId);

  res.status(200).json({
    success: true,
    data: paymentIntent,
  });
});
