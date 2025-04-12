import asyncHandler from '../../middleware/asyncHandler.js';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import Invoice from '../../models/invoiceModel.js';
import StripeService from '../../services/stripeService.js';

// @desc    Create a payment intent for an invoice
// @route   POST /api/invoices/payment-intent
// @access  Public
export const createPaymentIntent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invoice ID is required',
    });
  }

  // Find the invoice to get the workspace information and amount
  const invoice = await Invoice.findById(id);

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

  // Get amount and currency from invoice
  const amount = Math.round(invoice.total * 100); // Convert to cents for Stripe and round to integer
  const currency = invoice.currency || 'usd';

  try {
    // Create payment intent using the service
    const paymentIntent = await StripeService.createPaymentIntent(
      amount,
      currency,
      connectAccount.accountId,
    );

    // Store the payment intent ID in the invoice
    invoice.paymentIntentId = paymentIntent.id;
    await invoice.save();

    res.status(201).json({
      success: true,
      data: paymentIntent,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: `Failed to create payment intent: ${error.message}`,
    });
  }
});
