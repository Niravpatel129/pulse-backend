import Stripe from 'stripe';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import Invoice2 from '../../models/invoice2.js';
import catchAsync from '../../utils/catchAsync.js';

const stripe =
  process.env.NODE_ENV === 'production'
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : new Stripe(process.env.STRIPE_SECRET_KEY_DEV);

// Create a payment intent for an invoice
export const createPaymentIntent = catchAsync(async (req, res) => {
  const { invoiceId } = req.body;

  if (!invoiceId) {
    return res.status(400).json({
      status: 'error',
      message: 'Invoice ID is required',
    });
  }

  // Find the invoice with workspace data
  const invoice = await Invoice2.findById(invoiceId).populate('workspace');

  if (!invoice) {
    return res.status(404).json({
      status: 'error',
      message: 'Invoice not found',
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

  // Get payment amount from invoice
  const paymentAmount = Math.round(invoice.totals.total * 100);
  const paymentCurrency = invoice.settings?.currency || 'usd';

  try {
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: paymentAmount,
      currency: paymentCurrency,
      transfer_data: {
        destination: connectAccount.accountId,
      },
      statement_descriptor_suffix: invoice.workspace.name?.substring(0, 22) || 'PAYMENT',
      metadata: {
        invoiceId: invoice._id.toString(),
        workspaceId: invoice.workspace._id.toString(),
      },
    });

    // Store the payment intent ID in the invoice
    invoice.paymentIntentId = paymentIntent.id;
    await invoice.save();

    res.status(201).json({
      status: 'success',
      data: {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        amount: paymentAmount,
        currency: paymentCurrency,
        status: paymentIntent.status,
      },
    });
  } catch (error) {
    return res.status(400).json({
      status: 'error',
      message: `Failed to create payment intent: ${error.message}`,
    });
  }
});
