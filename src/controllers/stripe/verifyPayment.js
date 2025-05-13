import asyncHandler from '../../middleware/asyncHandler.js';
import Invoice from '../../models/invoiceModel.js';
import Payment from '../../models/paymentModel.js';
import StripeService from '../../services/stripeService.js';

// @desc    Verify a Stripe payment
// @route   POST /api/stripe/verify-payment
// @access  Public
export const verifyPayment = asyncHandler(async (req, res) => {
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

  //
  console.log('🚀 paymentIntentDetails:', paymentIntentDetails);

  if (paymentIntentDetails.status !== 'succeeded') {
    return res.status(400).json({
      success: false,
      message: 'Payment verification failed',
    });
  }

  // Find the invoice associated with this payment intent
  const invoice = await Invoice.findOne({
    paymentIntentId: paymentIntent,
  });

  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Invoice not found for this payment',
    });
  }

  // Update invoice status to paid
  invoice.status = 'paid';
  invoice.paidAt = new Date();
  await invoice.save();

  // create a payment
  const payment = await Payment.create({
    invoice: invoice._id,
    amount: paymentIntentDetails.amount,
    date: new Date(paymentIntentDetails.created * 1000),
    method: paymentIntentDetails.payment_method_types[0] || 'credit-card',
    workspace: invoice.workspace,
    createdBy: invoice.createdBy,
    paymentNumber: (await Payment.countDocuments({ invoice: invoice._id })) + 1,
    remainingBalance: invoice.total - paymentIntentDetails.amount,
    type: 'payment',
    status: 'completed',
    memo: `Stripe Payment ID: ${paymentIntentDetails.id}`,
    stripePaymentDetails: paymentIntentDetails, // Store complete payment intent details
  });

  res.status(200).json({
    success: true,
    message: 'Payment verified successfully',
    data: {
      invoice,
      paymentIntent: paymentIntentDetails,
    },
  });
});
