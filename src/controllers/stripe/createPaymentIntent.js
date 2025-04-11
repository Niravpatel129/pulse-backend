import asyncHandler from '../../middleware/asyncHandler.js';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import Invoice from '../../models/invoiceModel.js';
import StripeService from '../../services/stripeService.js';

// @desc    Create a payment intent
// @route   POST /api/stripe/payment-intent
// @access  Public
export const createPaymentIntent = asyncHandler(async (req, res) => {
  const { amount, currency, invoiceId } = req.body;

  if (!invoiceId) {
    return res.status(400).json({
      success: false,
      message: 'Invoice ID is required',
    });
  }

  // Find the invoice to get the workspace information
  const invoice = await Invoice.findById(invoiceId);

  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Invoice not found',
    });
  }

  // Find the connected account for the workspace
  const connectAccount = await StripeConnectAccount.findOne({
    workspace: invoice.workspace,
  });

  if (!connectAccount) {
    return res.status(404).json({
      success: false,
      message: 'No Stripe account found for this invoice',
    });
  }

  // Create payment intent using the service
  const paymentIntent = await StripeService.createPaymentIntent(
    amount,
    currency,
    connectAccount.accountId,
  );

  res.status(201).json({
    success: true,
    data: paymentIntent,
    clientSecret: paymentIntent.client_secret,
  });
});
