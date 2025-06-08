import Stripe from 'stripe';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import Invoice2 from '../../models/invoice2.js';
import catchAsync from '../../utils/catchAsync.js';

const stripe =
  process.env.NODE_ENV === 'production'
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : new Stripe(process.env.STRIPE_SECRET_KEY_DEV);

// Check the status of a payment intent
export const checkPaymentStatus = catchAsync(async (req, res) => {
  const { paymentIntentId } = req.query;

  if (!paymentIntentId) {
    return res.status(400).json({
      status: 'error',
      message: 'Payment intent ID is required',
    });
  }

  try {
    // Find the invoice with this payment intent
    const invoice = await Invoice2.findOne({ paymentIntentId }).populate('workspace');

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

    // Retrieve the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      stripeAccount: connectAccount.accountId,
    });

    // Return the payment status and relevant details
    res.status(200).json({
      status: 'success',
      data: {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        amount_received: paymentIntent.amount_received,
        currency: paymentIntent.currency,
        payment_method: paymentIntent.payment_method,
        payment_method_types: paymentIntent.payment_method_types,
        created: paymentIntent.created,
        client_secret: paymentIntent.client_secret,
        payment_method_details: {
          card: paymentIntent.payment_method_details?.card
            ? {
                brand: paymentIntent.payment_method_details.card.brand,
                last4: paymentIntent.payment_method_details.card.last4,
                exp_month: paymentIntent.payment_method_details.card.exp_month,
                exp_year: paymentIntent.payment_method_details.card.exp_year,
              }
            : null,
        },
        transfer_data: paymentIntent.transfer_data,
        metadata: paymentIntent.metadata,
      },
    });
  } catch (error) {
    console.error('Payment status check error:', error);
    return res.status(400).json({
      status: 'error',
      message: `Failed to check payment status: ${error.message}`,
    });
  }
});
