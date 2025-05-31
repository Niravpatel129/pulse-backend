import asyncHandler from '../../middleware/asyncHandler.js';
import Client from '../../models/Client.js';
import Invoice from '../../models/invoiceModel.js';
import Payment from '../../models/paymentModel.js';
import Workspace from '../../models/Workspace.js';
import { sendPaymentNotifications } from '../../services/paymentNotificationService.js';
import StripeService from '../../services/stripeService.js';

// @desc    Verify a Stripe payment
// @route   POST /api/stripe/verify-payment
// @access  Public
export const verifyPayment = asyncHandler(async (req, res) => {
  try {
    const { paymentIntent, paymentIntentClientSecret } = req.body;

    if (!paymentIntent || !paymentIntentClientSecret) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent and client secret are required',
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

    // Find the invoice associated with this payment intent
    const invoice = await Invoice.findOne({
      paymentIntentId: paymentIntent,
    }).populate('client');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found for this payment',
      });
    }

    // Calculate payment amount in dollars
    const paymentAmount = paymentIntentDetails.amount / 100;
    const isFullPayment = paymentAmount >= invoice.total;
    const isDepositPayment =
      invoice.requireDeposit &&
      Math.abs(paymentAmount - (invoice.total * invoice.depositPercentage) / 100) < 0.01;

    // Determine payment type and status for timeline
    let paymentType = 'payment';
    let newStatus = 'partially_paid';

    if (isFullPayment) {
      newStatus = 'paid';
      invoice.paidAt = new Date();
    } else if (isDepositPayment) {
      paymentType = 'deposit';
      newStatus = 'deposit_paid';
    }

    // Add timeline entry for payment
    const timelineEntry = {
      type: 'payment_succeeded',
      timestamp: new Date(),
      description: isFullPayment
        ? `Payment of ${paymentAmount} ${invoice.currency} received - Invoice paid in full`
        : isDepositPayment
        ? `Deposit payment of ${paymentAmount} ${invoice.currency} received`
        : `Partial payment of ${paymentAmount} ${invoice.currency} received`,
      metadata: {
        paymentId: paymentIntentDetails.id,
        amount: paymentAmount,
        currency: invoice.currency,
        paymentMethod: paymentIntentDetails.payment_method_types[0] || 'credit-card',
        previousStatus: invoice.status,
        newStatus: newStatus,
      },
    };

    // Add status change timeline entry if status changed
    if (invoice.status !== newStatus) {
      const statusChangeEntry = {
        type: 'status_change',
        timestamp: new Date(),
        description: `Invoice status changed from ${invoice.status} to ${newStatus}`,
        metadata: {
          previousStatus: invoice.status,
          newStatus: newStatus,
        },
      };
      invoice.timeline.push(statusChangeEntry);
    }

    // Add payment timeline entry
    invoice.timeline.push(timelineEntry);

    // Update invoice status
    invoice.status = newStatus;
    invoice.statusChangedAt = new Date();
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
      remainingBalance: invoice.total - paymentAmount,
      type: isDepositPayment ? 'deposit' : 'payment',
      status: 'completed',
      memo: `Stripe Payment ID: ${paymentIntentDetails.id}`,
      stripePaymentDetails: {
        id: paymentIntentDetails.id,
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

    // Get workspace and client data for notifications
    const workspace = await Workspace.findById(invoice.workspace);
    const client = await Client.findById(invoice.client).populate('user');

    // Send payment notifications
    const paymentTypeForNotification = isDepositPayment ? 'deposit' : 'payment';
    if (paymentTypeForNotification === 'payment' || paymentTypeForNotification === 'deposit') {
      // Send notifications asynchronously - don't wait for completion
      sendPaymentNotifications(payment, invoice, client, workspace).catch((err) =>
        console.error('Error sending payment notifications:', err),
      );
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        invoice,
        payment,
        paymentIntent: paymentIntentDetails,
      },
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message,
    });
  }
});
