import asyncHandler from '../../middleware/asyncHandler.js';
import Invoice from '../../models/invoiceModel.js';
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

  res.status(200).json({
    success: true,
    message: 'Payment verified successfully',
    data: {
      invoice,
      paymentIntent: paymentIntentDetails,
    },
  });
});
