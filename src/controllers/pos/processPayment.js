import Stripe from 'stripe';
import StripeTerminalReader from '../../models/StripeTerminalReader.js';
import catchAsync from '../../utils/catchAsync.js';

const stripe =
  process.env.NODE_ENV === 'production'
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : new Stripe(process.env.STRIPE_SECRET_KEY_DEV);

// Process a payment through a Stripe Terminal reader
export const processPayment = catchAsync(async (req, res) => {
  const { readerId } = req.params;
  console.log('🚀 readerId:', readerId);
  const { paymentIntentId } = req.body;

  if (!paymentIntentId) {
    return res.status(400).json({
      status: 'error',
      message: 'Payment intent ID is required',
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
    // Process the payment through the reader
    const paymentIntent = await stripe.terminal.readers.processPaymentIntent(
      readerId,
      {
        payment_intent: paymentIntentId,
      },
      {
        stripeAccount: reader.stripeAccount,
      },
    );

    // Update reader's last used timestamp
    reader.lastUsedAt = new Date();
    await reader.save();

    // Get detailed payment intent information
    const paymentIntentDetails = await stripe.paymentIntents.retrieve(paymentIntentId, {
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
