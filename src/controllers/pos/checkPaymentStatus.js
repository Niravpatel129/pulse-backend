import Stripe from 'stripe';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import Invoice2 from '../../models/invoice2.js';
import catchAsync from '../../utils/catchAsync.js';

const stripe =
  process.env.NODE_ENV === 'production'
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : new Stripe(process.env.STRIPE_SECRET_KEY_DEV);

export const checkPaymentStatus = catchAsync(async (req, res) => {
  const { paymentIntentId } = req.query;

  if (!paymentIntentId) {
    return res.status(400).json({
      status: 'error',
      message: 'Payment intent ID is required',
    });
  }

  try {
    // Find the invoice with this payment intent
    const invoice = await Invoice2.findOne({ paymentIntentId }).populate('workspace');

    if (!invoice) {
      return res.status(404).json({
        status: 'error',
        message: 'No invoice found for this payment intent',
      });
    }

    // Find the connected account for the workspace
    const connectAccount = await StripeConnectAccount.findOne({
      workspace: invoice.workspace,
    });

    if (!connectAccount) {
      return res.status(404).json({
        status: 'error',
        message: 'No Stripe account found for this invoice',
      });
    }

    // Retrieve the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      stripeAccount: connectAccount.accountId,
    });

    // Return the payment status and relevant details
    res.status(200).json({
      status: 'success',
      data: {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        amount_received: paymentIntent.amount_received,
        currency: paymentIntent.currency,
        payment_method: paymentIntent.payment_method,
        payment_method_types: paymentIntent.payment_method_types,
        created: paymentIntent.created,
        client_secret: paymentIntent.client_secret,
        payment_method_details: {
          card: paymentIntent.payment_method_details?.card
            ? {
                brand: paymentIntent.payment_method_details.card.brand,
                last4: paymentIntent.payment_method_details.card.last4,
                exp_month: paymentIntent.payment_method_details.card.exp_month,
                exp_year: paymentIntent.payment_method_details.card.exp_year,
              }
            : null,
        },
        transfer_data: paymentIntent.transfer_data,
        metadata: paymentIntent.metadata,
      },
    });
  } catch (error) {
    console.error('Payment status check error:', error);
    return res.status(400).json({
      status: 'error',
      message: `Failed to check payment status: ${error.message}`,
    });
  }
});

// Mark an invoice as paid
export const markInvoiceAsPaid = catchAsync(async (req, res) => {
  const { invoiceId } = req.params;
  const { paymentDate, paymentMethod } = req.body;

  if (!paymentDate) {
    return res.status(400).json({
      status: 'error',
      message: 'Payment date is required',
    });
  }

  // Validate payment date is not in the future
  const paymentDateObj = new Date(paymentDate);
  if (paymentDateObj > new Date()) {
    return res.status(400).json({
      status: 'error',
      message: 'Payment date cannot be in the future',
    });
  }

  // Validate payment method
  const validPaymentMethods = ['bank_transfer', 'credit_card', 'cash', 'check', 'other'];
  if (paymentMethod && !validPaymentMethods.includes(paymentMethod)) {
    return res.status(400).json({
      status: 'error',
      message: `Invalid payment method. Must be one of: ${validPaymentMethods.join(', ')}`,
    });
  }

  const invoice = await Invoice2.findOne({ _id: invoiceId, workspace: req.workspace._id });

  if (!invoice) {
    return res.status(404).json({
      status: 'error',
      message: 'Invoice not found',
    });
  }

  // Don't allow marking already paid or cancelled invoices as paid
  if (invoice.status === 'paid') {
    return res.status(400).json({
      status: 'error',
      message: 'Invoice is already marked as paid',
    });
  }
  if (invoice.status === 'cancelled') {
    return res.status(400).json({
      status: 'error',
      message: 'Cannot mark a cancelled invoice as paid',
    });
  }

  invoice.status = 'paid';
  invoice.paymentDate = paymentDate;
  invoice.paymentMethod = paymentMethod || 'bank_transfer';
  invoice.paidAt = new Date();
  invoice.statusChangedAt = new Date();
  invoice.statusChangedBy = req.user.userId;

  // Add to status history
  invoice.statusHistory.push({
    status: 'paid',
    changedAt: new Date(),
    changedBy: req.user.userId,
    reason: 'Invoice marked as paid',
  });

  await invoice.save();

  res.status(200).json({
    status: 'success',
    data: invoice,
  });
});
