import asyncHandler from '../../middleware/asyncHandler.js';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import Invoice2 from '../../models/invoice2.js';
import StripeService from '../../services/stripeService.js';

// @desc    Create a payment intent for an invoice2
// @route   POST /api/invoices2/:id/payment-intent
// @access  Public
export const createPaymentIntent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, currency, isDeposit } = req.body;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invoice ID is required',
    });
  }

  // Find the invoice to get the workspace information and amount
  const invoice = await Invoice2.findById(id);

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

  // Calculate payment amount based on the request
  let paymentAmount;
  if (amount) {
    // If custom amount is provided, use it (already in cents)
    paymentAmount = amount;
  } else if (isDeposit && invoice.requireDeposit) {
    // If deposit is requested and invoice requires deposit
    paymentAmount = Math.round(invoice.totals.total * (invoice.depositPercentage / 100) * 100);
  } else {
    // Default to full amount
    paymentAmount = Math.round(invoice.totals.total * 100);
  }

  // Validate payment amount
  if (paymentAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payment amount',
    });
  }

  if (paymentAmount > Math.round(invoice.totals.total * 100)) {
    return res.status(400).json({
      success: false,
      message: 'Payment amount cannot exceed invoice total',
    });
  }

  const paymentCurrency = currency || invoice.settings.currency || 'usd';

  try {
    // Create payment intent using the service
    const paymentIntent = await StripeService.createPaymentIntent(
      paymentAmount,
      paymentCurrency,
      connectAccount.accountId,
    );

    // Store the payment intent ID in the invoice
    invoice.paymentIntentId = paymentIntent.id;

    // Add a timeline entry for the payment intent creation
    // Don't add timeline entry if request comes from workspace user (for testing)
    const isInternalRequest =
      req.user && String(req.user.workspaceId) === String(invoice.workspace);

    if (!isInternalRequest) {
      const paymentAttemptEntry = {
        status: invoice.status,
        changedAt: new Date(),
        changedBy: req.user?.userId || 'system',
        reason: isDeposit
          ? `Client initiated a deposit payment of ${
              paymentAmount / 100
            } ${paymentCurrency.toUpperCase()}`
          : `Client initiated a payment of ${paymentAmount / 100} ${paymentCurrency.toUpperCase()}`,
      };

      invoice.statusHistory.push(paymentAttemptEntry);
    }

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
