import asyncHandler from '../../middleware/asyncHandler.js';
import Invoice2 from '../../models/invoice2.js';
import PaymentIntent from '../../models/PaymentIntent.js';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
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
  const invoice = await Invoice2.findById(id).populate('workspace');

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

  console.log('🚀 connectAccount:', connectAccount);

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
    const stripePaymentIntent = await StripeService.createPaymentIntent(
      paymentAmount,
      paymentCurrency,
      connectAccount.accountId,
      invoice.workspace.name || invoice.workspace.subdomain,
    );

    // Determine payment type
    let paymentType = 'full_payment';
    if (isDeposit) {
      paymentType = 'deposit';
    } else if (amount && amount < Math.round(invoice.totals.total * 100)) {
      paymentType = 'partial_payment';
    }

    // Create payment intent record in database
    const paymentIntentRecord = new PaymentIntent({
      stripePaymentIntentId: stripePaymentIntent.id,
      clientSecret: stripePaymentIntent.client_secret,
      invoice: invoice._id,
      workspace: invoice.workspace._id,
      amount: paymentAmount,
      currency: paymentCurrency,
      status: stripePaymentIntent.status,
      paymentType,
      isDeposit,
      depositPercentage: isDeposit ? invoice.depositPercentage : null,
      stripeConnectAccount: connectAccount._id,
      customer: {
        id: invoice.customer?.id,
        name: invoice.customer?.name,
        email: invoice.customer?.email,
      },
      description: `Payment for invoice ${invoice.invoiceNumber}`,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        invoiceTitle: invoice.invoiceTitle,
        source: 'invoice_payment',
      },
      createdBy: invoice.createdBy,
      clientIp: req.ip,
      userAgent: req.get('User-Agent'),
      source: 'web',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    });

    // Add initial status to history
    paymentIntentRecord.statusHistory.push({
      status: stripePaymentIntent.status,
      timestamp: new Date(),
      reason: 'Payment intent created',
    });

    await paymentIntentRecord.save();

    // Store the payment intent ID in the invoice (for backward compatibility)
    invoice.paymentIntentId = stripePaymentIntent.id;

    // Add a timeline entry for the payment intent creation
    const paymentAttemptEntry = {
      status: 'seen',
      changedAt: new Date(),
      reason: isDeposit
        ? `Client initiated a deposit payment of ${
            paymentAmount / 100
          } ${paymentCurrency.toUpperCase()}`
        : `Client initiated a payment of ${paymentAmount / 100} ${paymentCurrency.toUpperCase()}`,
    };

    invoice.statusHistory.push(paymentAttemptEntry);

    await invoice.save();

    res.status(201).json({
      success: true,
      data: {
        ...stripePaymentIntent,
        paymentIntentRecordId: paymentIntentRecord._id,
      },
      clientSecret: stripePaymentIntent.client_secret,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: `Failed to create payment intent: ${error.message}`,
    });
  }
});
