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

    // Update invoice status based on payment type
    if (isFullPayment) {
      invoice.status = 'paid';
      invoice.paidAt = new Date();
    } else if (isDepositPayment) {
      invoice.status = 'deposit_paid';
    } else {
      invoice.status = 'partially_paid';
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
    const paymentType = isDepositPayment ? 'deposit' : 'payment';
    if (paymentType === 'payment' || paymentType === 'deposit') {
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
