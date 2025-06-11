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

  try {
    // Find the invoice with workspace data
    const invoice = await Invoice2.findById(invoiceId).populate('workspace');
    console.error('Invoice found:', invoice?._id);

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
    console.error('Connect account found:', connectAccount?.accountId);

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
    console.error('Reader details:', {
      readerId: reader?.readerId,
      status: reader?.status,
      stripeAccount: reader?.stripeAccount,
      locationId: reader?.locationId,
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

    // Get payment amount from invoice
    const paymentAmount = Math.round(invoice.totals.total * 100);
    const paymentCurrency = invoice.settings?.currency || 'usd';
    console.error('Payment details:', { amount: paymentAmount, currency: paymentCurrency });

    // Create payment intent on the connected account
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: paymentAmount,
        currency: paymentCurrency,
        statement_descriptor_suffix: invoice.workspace.name?.substring(0, 22) || 'PAYMENT',
        metadata: {
          invoiceId: invoice._id.toString(),
          workspaceId: invoice.workspace._id.toString(),
        },
        payment_method_types: ['card_present'],
        capture_method: 'automatic',
      },
      {
        stripeAccount: connectAccount.accountId, // Create on connected account
      },
    );
    console.error('Payment Intent created:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    });

    // Store the payment intent ID in the invoice
    invoice.paymentIntentId = paymentIntent.id;
    await invoice.save();
    console.error('Invoice updated with payment intent');

    // Process the payment through the reader using the connected account
    console.error('Processing payment with reader:', {
      readerId: reader.readerId,
      stripeAccount: connectAccount.accountId,
      paymentIntentId: paymentIntent.id,
    });

    const processedPayment = await stripe.terminal.readers.processPaymentIntent(
      reader.readerId,
      {
        payment_intent: paymentIntent.id,
      },
      {
        stripeAccount: connectAccount.accountId,
      },
    );
    console.error('Payment processed:', processedPayment);

    // Update reader's last used timestamp
    reader.lastUsedAt = new Date();
    await reader.save();

    // Get detailed payment intent information from the connected account
    const paymentIntentDetails = await stripe.paymentIntents.retrieve(paymentIntent.id, {
      stripeAccount: connectAccount.accountId,
    });
    console.error('Payment Intent retrieved:', {
      id: paymentIntentDetails.id,
      status: paymentIntentDetails.status,
      amount: paymentIntentDetails.amount,
      amount_received: paymentIntentDetails.amount_received,
    });

    if (error.code === 'terminal_reader_timeout') {
      // Optionally, cancel any pending action on the reader
      try {
        await stripe.terminal.readers.cancelAction(reader.readerId, {
          stripeAccount: connectAccount.accountId,
        });
      } catch (cancelError) {
        // Log or handle cancel error, but don't block the main flow
      }
      return res.status(408).json({
        status: 'error',
        message: 'The reader timed out. Please check the reader and try again.',
        code: 'terminal_reader_timeout',
      });
    }

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
    console.error('Payment processing error:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack,
    });
    return res.status(400).json({
      status: 'error',
      message: `Failed to process payment: ${error.message}`,
    });
  }
});

// Cancel a payment intent
export const cancelPaymentIntent = catchAsync(async (req, res) => {
  const { paymentIntentId, readerId } = req.body;

  if (!paymentIntentId) {
    return res.status(400).json({
      status: 'error',
      message: 'Payment intent ID is required',
    });
  }

  try {
    // Find the invoice associated with this payment intent
    const invoice = await Invoice2.findOne({ paymentIntentId });

    if (!invoice) {
      return res.status(404).json({
        status: 'error',
        message: 'No invoice found for this payment intent',
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

    // If readerId is provided, cancel the payment on the reader
    if (readerId) {
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

      // Cancel the payment on the reader
      await stripe.terminal.readers.cancelAction(readerId, {
        stripeAccount: connectAccount.accountId,
      });
    }

    // Cancel the payment intent on the connected account
    const canceledPaymentIntent = await stripe.paymentIntents.cancel(paymentIntentId, {
      stripeAccount: connectAccount.accountId,
    });

    // Update the invoice status
    invoice.paymentIntentId = null;
    await invoice.save();

    // Add a timeline entry for the cancellation
    const cancellationEntry = {
      status: 'seen',
      changedAt: new Date(),
      reason: 'Payment was canceled',
    };
    invoice.statusHistory.push(cancellationEntry);
    await invoice.save();

    res.status(200).json({
      status: 'success',
      data: {
        id: canceledPaymentIntent.id,
        status: canceledPaymentIntent.status,
        amount: canceledPaymentIntent.amount,
        currency: canceledPaymentIntent.currency,
        canceled_at: canceledPaymentIntent.canceled_at,
      },
    });
  } catch (error) {
    console.error('Payment cancellation error:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack,
    });
    return res.status(400).json({
      status: 'error',
      message: `Failed to cancel payment: ${error.message}`,
    });
  }
});
