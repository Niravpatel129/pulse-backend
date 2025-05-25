import asyncHandler from '../../middleware/asyncHandler.js';
import Invoice2 from '../../models/invoice2.js';
import Payment from '../../models/paymentModel.js';
import { sendPaymentNotifications } from '../../services/paymentNotificationService.js';
import StripeService from '../../services/stripeService.js';

// @desc    Handle successful payment for an invoice
// @route   POST /api/invoices2/:id/payment-success
// @access  Public
export const handlePaymentSuccess = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentIntent, paymentIntentClientSecret } = req.body;

  if (!paymentIntent || !paymentIntentClientSecret) {
    return res.status(400).json({
      success: false,
      message: 'Payment intent and client secret are required',
    });
  }

  // Find the invoice
  const invoice = await Invoice2.findById(id).populate('customer.id');

  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Invoice not found',
    });
  }

  // Verify the payment with Stripe
  const paymentIntentDetails = await StripeService.verifyPaymentIntent(
    paymentIntent,
    paymentIntentClientSecret,
  );

  if (paymentIntentDetails.status !== 'succeeded') {
    return res.status(400).json({
      success: false,
      message: 'Payment verification failed',
    });
  }

  // Verify the payment intent matches
  if (invoice.paymentIntentId !== paymentIntent) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payment intent for this invoice',
    });
  }

  // Calculate payment amount in dollars
  const paymentAmount = paymentIntentDetails.amount / 100;
  const isFullPayment = paymentAmount >= invoice.totals.total;
  const isDepositPayment =
    invoice.requireDeposit &&
    Math.abs(paymentAmount - (invoice.totals.total * invoice.depositPercentage) / 100) < 0.01;

  // Determine new status
  let newStatus = 'partially_paid';
  if (isFullPayment) {
    newStatus = 'paid';
  } else if (isDepositPayment) {
    newStatus = 'deposit_paid';
  }

  // Add status change to history
  const statusChangeEntry = {
    status: newStatus,
    changedAt: new Date(),
    changedBy: req.user?.userId || 'system',
    reason: isFullPayment
      ? `Payment of ${paymentAmount} ${paymentIntentDetails.currency.toUpperCase()} received - Invoice paid in full`
      : isDepositPayment
      ? `Deposit payment of ${paymentAmount} ${paymentIntentDetails.currency.toUpperCase()} received`
      : `Partial payment of ${paymentAmount} ${paymentIntentDetails.currency.toUpperCase()} received`,
  };

  invoice.statusHistory.push(statusChangeEntry);

  // Update invoice status
  invoice.status = newStatus;
  if (isFullPayment) {
    invoice.paidAt = new Date();
    invoice.paidBy = req.user?.userId || 'system';
  }
  await invoice.save();

  // Create a payment record
  const payment = await Payment.create({
    invoice: invoice._id,
    amount: paymentAmount,
    date: new Date(paymentIntentDetails.created * 1000),
    method: paymentIntentDetails.payment_method_types[0] || 'credit-card',
    workspace: invoice.workspace,
    createdBy: invoice.createdBy,
    paymentNumber: (await Payment.countDocuments({ invoice: invoice._id })) + 1,
    remainingBalance: invoice.totals.total - paymentAmount,
    type: isDepositPayment ? 'deposit' : 'payment',
    status: 'completed',
    memo: `Stripe Payment ID: ${paymentIntent}`,
    stripePaymentDetails: {
      id: paymentIntent,
      amount: paymentIntentDetails.amount,
      amount_received: paymentIntentDetails.amount_received,
      application_fee_amount: paymentIntentDetails.application_fee_amount,
      currency: paymentIntentDetails.currency,
      payment_method: paymentIntentDetails.payment_method,
      payment_method_types: paymentIntentDetails.payment_method_types,
      status: paymentIntentDetails.status,
      transfer_data: paymentIntentDetails.transfer_data,
      transfer_group: paymentIntentDetails.transfer_group,
      latest_charge: paymentIntentDetails.latest_charge,
    },
  });

  // Send payment notifications
  if (payment.type === 'payment' || payment.type === 'deposit') {
    // Send notifications asynchronously - don't wait for completion
    sendPaymentNotifications(payment, invoice, invoice.customer.id, invoice.workspace).catch(
      (err) => console.error('Error sending payment notifications:', err),
    );
  }

  res.status(200).json({
    success: true,
    message: 'Payment processed successfully',
    data: {
      invoice,
      payment,
      paymentIntent: paymentIntentDetails,
    },
  });
});
