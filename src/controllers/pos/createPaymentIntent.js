import Stripe from 'stripe';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import StripeTerminalReader from '../../models/StripeTerminalReader.js';
import Invoice2 from '../../models/invoice2.js';
import catchAsync from '../../utils/catchAsync.js';

const stripe =
  process.env.NODE_ENV === 'production'
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : new Stripe(process.env.STRIPE_SECRET_KEY_DEV);

// Create and process a payment through Stripe Terminal
export const createAndProcessPayment = catchAsync(async (req, res) => {
  const { invoiceId, readerId } = req.body;

  if (!invoiceId || !readerId) {
    return res.status(400).json({
      status: 'error',
      message: 'Invoice ID and Reader ID are required',
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

  // Find the reader
  const reader = await StripeTerminalReader.findOne({
    workspace: req.workspace._id,
    readerId,
  });

  if (!reader) {
    return res.status(404).json({
      status: 'error',
      message: 'Reader not found',
    });
  }

  if (reader.status !== 'online') {
    return res.status(400).json({
      status: 'error',
      message: 'Reader is not online',
    });
  }

  try {
    // Get payment amount from invoice
    const paymentAmount = Math.round(invoice.totals.total * 100);
    const paymentCurrency = invoice.settings?.currency || 'usd';

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
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
    });

    // Store the payment intent ID in the invoice
    invoice.paymentIntentId = paymentIntent.id;
    await invoice.save();

    // Process the payment through the reader
    await stripe.terminal.readers.processPaymentIntent(
      readerId,
      {
        payment_intent: paymentIntent.id,
      },
      {
        stripeAccount: reader.stripeAccount,
      },
    );

    // Update reader's last used timestamp
    reader.lastUsedAt = new Date();
    await reader.save();

    // Get detailed payment intent information
    const paymentIntentDetails = await stripe.paymentIntents.retrieve(paymentIntent.id, {
      stripeAccount: reader.stripeAccount,
    });

    res.status(200).json({
      status: 'success',
      data: {
        id: paymentIntentDetails.id,
        status: paymentIntentDetails.status,
        amount: paymentIntentDetails.amount,
        amount_received: paymentIntentDetails.amount_received,
        currency: paymentIntentDetails.currency,
        payment_method: paymentIntentDetails.payment_method,
        payment_method_types: paymentIntentDetails.payment_method_types,
        created: paymentIntentDetails.created,
        client_secret: paymentIntentDetails.client_secret,
        payment_method_details: {
          card: paymentIntentDetails.payment_method_details?.card
            ? {
                brand: paymentIntentDetails.payment_method_details.card.brand,
                last4: paymentIntentDetails.payment_method_details.card.last4,
                exp_month: paymentIntentDetails.payment_method_details.card.exp_month,
                exp_year: paymentIntentDetails.payment_method_details.card.exp_year,
              }
            : null,
        },
        transfer_data: paymentIntentDetails.transfer_data,
        metadata: paymentIntentDetails.metadata,
      },
    });
  } catch (error) {
    return res.status(400).json({
      status: 'error',
      message: `Failed to process payment: ${error.message}`,
    });
  }
});
