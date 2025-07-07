import asyncHandler from '../../middleware/asyncHandler.js';
import PaymentIntent from '../../models/PaymentIntent.js';
import StripeService from '../../services/stripeService.js';

// @desc    Handle Stripe webhook events for payment intents
// @route   POST /api/invoices2/webhook/stripe
// @access  Public
export const handleStripeWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = StripeService.constructWebhookEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Received Stripe webhook event:', event.type);

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object);
      break;
    case 'payment_intent.canceled':
      await handlePaymentIntentCanceled(event.data.object);
      break;
    case 'payment_intent.processing':
      await handlePaymentIntentProcessing(event.data.object);
      break;
    case 'payment_intent.requires_action':
      await handlePaymentIntentRequiresAction(event.data.object);
      break;
    case 'payment_intent.requires_confirmation':
      await handlePaymentIntentRequiresConfirmation(event.data.object);
      break;
    case 'payment_intent.requires_payment_method':
      await handlePaymentIntentRequiresPaymentMethod(event.data.object);
      break;
    case 'payment_intent.requires_capture':
      await handlePaymentIntentRequiresCapture(event.data.object);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

// Handle payment intent succeeded
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  try {
    const dbPaymentIntent = await PaymentIntent.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!dbPaymentIntent) {
      console.error('Payment intent not found in database:', paymentIntent.id);
      return;
    }

    // Update payment intent status
    await dbPaymentIntent.addWebhookEvent(paymentIntent.id, 'payment_intent.succeeded');

    dbPaymentIntent.status = 'succeeded';
    dbPaymentIntent.statusHistory.push({
      status: 'succeeded',
      timestamp: new Date(),
      reason: 'Payment completed successfully',
      metadata: {
        webhookEvent: 'payment_intent.succeeded',
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      },
    });

    // Update payment method details if available
    if (paymentIntent.payment_method) {
      dbPaymentIntent.paymentMethod = {
        type: paymentIntent.payment_method.type,
        card: paymentIntent.payment_method.card
          ? {
              brand: paymentIntent.payment_method.card.brand,
              last4: paymentIntent.payment_method.card.last4,
              expMonth: paymentIntent.payment_method.card.exp_month,
              expYear: paymentIntent.payment_method.card.exp_year,
              country: paymentIntent.payment_method.card.country,
            }
          : null,
        billingDetails: paymentIntent.payment_method.billing_details
          ? {
              name: paymentIntent.payment_method.billing_details.name,
              email: paymentIntent.payment_method.billing_details.email,
              phone: paymentIntent.payment_method.billing_details.phone,
              address: paymentIntent.payment_method.billing_details.address,
            }
          : null,
      };
    }

    await dbPaymentIntent.save();
    console.log('Payment intent succeeded updated:', paymentIntent.id);
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
  }
};

// Handle payment intent failed
const handlePaymentIntentFailed = async (paymentIntent) => {
  try {
    const dbPaymentIntent = await PaymentIntent.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!dbPaymentIntent) {
      console.error('Payment intent not found in database:', paymentIntent.id);
      return;
    }

    await dbPaymentIntent.addWebhookEvent(paymentIntent.id, 'payment_intent.payment_failed');

    dbPaymentIntent.status = 'failed';
    dbPaymentIntent.statusHistory.push({
      status: 'failed',
      timestamp: new Date(),
      reason: 'Payment failed',
      metadata: {
        webhookEvent: 'payment_intent.payment_failed',
        lastPaymentError: paymentIntent.last_payment_error,
      },
    });

    // Store last payment error
    if (paymentIntent.last_payment_error) {
      dbPaymentIntent.lastPaymentError = {
        type: paymentIntent.last_payment_error.type,
        code: paymentIntent.last_payment_error.code,
        declineCode: paymentIntent.last_payment_error.decline_code,
        message: paymentIntent.last_payment_error.message,
        param: paymentIntent.last_payment_error.param,
        paymentMethod: paymentIntent.last_payment_error.payment_method,
      };
    }

    await dbPaymentIntent.save();
    console.log('Payment intent failed updated:', paymentIntent.id);
  } catch (error) {
    console.error('Error handling payment intent failed:', error);
  }
};

// Handle payment intent canceled
const handlePaymentIntentCanceled = async (paymentIntent) => {
  try {
    const dbPaymentIntent = await PaymentIntent.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!dbPaymentIntent) {
      console.error('Payment intent not found in database:', paymentIntent.id);
      return;
    }

    await dbPaymentIntent.addWebhookEvent(paymentIntent.id, 'payment_intent.canceled');

    dbPaymentIntent.status = 'canceled';
    dbPaymentIntent.canceledAt = new Date();
    dbPaymentIntent.cancellationReason =
      paymentIntent.cancellation_reason || 'requested_by_customer';

    dbPaymentIntent.statusHistory.push({
      status: 'canceled',
      timestamp: new Date(),
      reason: 'Payment intent canceled',
      metadata: {
        webhookEvent: 'payment_intent.canceled',
        cancellationReason: paymentIntent.cancellation_reason,
      },
    });

    await dbPaymentIntent.save();
    console.log('Payment intent canceled updated:', paymentIntent.id);
  } catch (error) {
    console.error('Error handling payment intent canceled:', error);
  }
};

// Handle payment intent processing
const handlePaymentIntentProcessing = async (paymentIntent) => {
  try {
    const dbPaymentIntent = await PaymentIntent.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!dbPaymentIntent) {
      console.error('Payment intent not found in database:', paymentIntent.id);
      return;
    }

    await dbPaymentIntent.addWebhookEvent(paymentIntent.id, 'payment_intent.processing');

    dbPaymentIntent.status = 'processing';
    dbPaymentIntent.statusHistory.push({
      status: 'processing',
      timestamp: new Date(),
      reason: 'Payment is being processed',
      metadata: {
        webhookEvent: 'payment_intent.processing',
      },
    });

    await dbPaymentIntent.save();
    console.log('Payment intent processing updated:', paymentIntent.id);
  } catch (error) {
    console.error('Error handling payment intent processing:', error);
  }
};

// Handle payment intent requires action
const handlePaymentIntentRequiresAction = async (paymentIntent) => {
  try {
    const dbPaymentIntent = await PaymentIntent.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!dbPaymentIntent) {
      console.error('Payment intent not found in database:', paymentIntent.id);
      return;
    }

    await dbPaymentIntent.addWebhookEvent(paymentIntent.id, 'payment_intent.requires_action');

    dbPaymentIntent.status = 'requires_action';
    dbPaymentIntent.nextAction = paymentIntent.next_action;

    dbPaymentIntent.statusHistory.push({
      status: 'requires_action',
      timestamp: new Date(),
      reason: 'Payment requires additional action',
      metadata: {
        webhookEvent: 'payment_intent.requires_action',
        nextActionType: paymentIntent.next_action?.type,
      },
    });

    await dbPaymentIntent.save();
    console.log('Payment intent requires action updated:', paymentIntent.id);
  } catch (error) {
    console.error('Error handling payment intent requires action:', error);
  }
};

// Handle payment intent requires confirmation
const handlePaymentIntentRequiresConfirmation = async (paymentIntent) => {
  try {
    const dbPaymentIntent = await PaymentIntent.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!dbPaymentIntent) {
      console.error('Payment intent not found in database:', paymentIntent.id);
      return;
    }

    await dbPaymentIntent.addWebhookEvent(paymentIntent.id, 'payment_intent.requires_confirmation');

    dbPaymentIntent.status = 'requires_confirmation';
    dbPaymentIntent.statusHistory.push({
      status: 'requires_confirmation',
      timestamp: new Date(),
      reason: 'Payment requires confirmation',
      metadata: {
        webhookEvent: 'payment_intent.requires_confirmation',
      },
    });

    await dbPaymentIntent.save();
    console.log('Payment intent requires confirmation updated:', paymentIntent.id);
  } catch (error) {
    console.error('Error handling payment intent requires confirmation:', error);
  }
};

// Handle payment intent requires payment method
const handlePaymentIntentRequiresPaymentMethod = async (paymentIntent) => {
  try {
    const dbPaymentIntent = await PaymentIntent.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!dbPaymentIntent) {
      console.error('Payment intent not found in database:', paymentIntent.id);
      return;
    }

    await dbPaymentIntent.addWebhookEvent(
      paymentIntent.id,
      'payment_intent.requires_payment_method',
    );

    dbPaymentIntent.status = 'requires_payment_method';
    dbPaymentIntent.statusHistory.push({
      status: 'requires_payment_method',
      timestamp: new Date(),
      reason: 'Payment requires payment method',
      metadata: {
        webhookEvent: 'payment_intent.requires_payment_method',
      },
    });

    await dbPaymentIntent.save();
    console.log('Payment intent requires payment method updated:', paymentIntent.id);
  } catch (error) {
    console.error('Error handling payment intent requires payment method:', error);
  }
};

// Handle payment intent requires capture
const handlePaymentIntentRequiresCapture = async (paymentIntent) => {
  try {
    const dbPaymentIntent = await PaymentIntent.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!dbPaymentIntent) {
      console.error('Payment intent not found in database:', paymentIntent.id);
      return;
    }

    await dbPaymentIntent.addWebhookEvent(paymentIntent.id, 'payment_intent.requires_capture');

    dbPaymentIntent.status = 'requires_capture';
    dbPaymentIntent.statusHistory.push({
      status: 'requires_capture',
      timestamp: new Date(),
      reason: 'Payment requires capture',
      metadata: {
        webhookEvent: 'payment_intent.requires_capture',
      },
    });

    await dbPaymentIntent.save();
    console.log('Payment intent requires capture updated:', paymentIntent.id);
  } catch (error) {
    console.error('Error handling payment intent requires capture:', error);
  }
};
