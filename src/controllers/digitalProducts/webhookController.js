import stripe from '../../config/stripe.js';
import DigitalProduct from '../../models/DigitalProduct.js';
import DigitalProductPurchase from '../../models/DigitalProductPurchase.js';
import emailService from '../../services/emailService.js';

// Handle Stripe webhook events for digital products
export const handleStripeWebhook = async (req, res, next) => {
  try {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      // Verify the webhook signature - req.body is now raw buffer thanks to express.raw()
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log(`✅ Webhook signature verified for event: ${event.type}`);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        console.log(`🎉 Processing payment success for: ${event.data.object.id}`);
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        console.log(`❌ Processing payment failure for: ${event.data.object.id}`);
        await handlePaymentFailed(event.data.object);
        break;
      case 'payment_intent.canceled':
        console.log(`🚫 Processing payment cancellation for: ${event.data.object.id}`);
        await handlePaymentCanceled(event.data.object);
        break;
      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('💥 Error handling webhook:', error);
    res.status(400).json({ error: 'Webhook handler failed' });
  }
};

// Handle successful payment
const handlePaymentSucceeded = async (paymentIntent) => {
  try {
    const purchase = await DigitalProductPurchase.findOne({
      'paymentInfo.stripePaymentIntentId': paymentIntent.id,
    }).populate('product');

    if (!purchase) {
      console.error('Purchase not found for payment intent:', paymentIntent.id);
      return;
    }

    // Update purchase status
    purchase.paymentInfo.paymentStatus = 'succeeded';
    purchase.status = 'completed';
    purchase.paymentInfo.paymentMethod = paymentIntent.payment_method || null;

    await purchase.save();

    // Increment download count for the product
    await DigitalProduct.findByIdAndUpdate(purchase.product._id, { $inc: { downloadCount: 1 } });

    // Send confirmation email (optional)
    try {
      await sendPurchaseConfirmationEmail(purchase);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't throw error - payment is still successful
    }

    console.log(`Payment succeeded for order: ${purchase.orderId}`);
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
};

// Handle failed payment
const handlePaymentFailed = async (paymentIntent) => {
  try {
    const purchase = await DigitalProductPurchase.findOne({
      'paymentInfo.stripePaymentIntentId': paymentIntent.id,
    });

    if (!purchase) {
      console.error('Purchase not found for payment intent:', paymentIntent.id);
      return;
    }

    // Update purchase status
    purchase.paymentInfo.paymentStatus = 'failed';
    purchase.status = 'failed';

    await purchase.save();

    console.log(`Payment failed for order: ${purchase.orderId}`);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
};

// Handle canceled payment
const handlePaymentCanceled = async (paymentIntent) => {
  try {
    const purchase = await DigitalProductPurchase.findOne({
      'paymentInfo.stripePaymentIntentId': paymentIntent.id,
    });

    if (!purchase) {
      console.error('Purchase not found for payment intent:', paymentIntent.id);
      return;
    }

    // Update purchase status
    purchase.paymentInfo.paymentStatus = 'canceled';
    purchase.status = 'failed';

    await purchase.save();

    console.log(`Payment canceled for order: ${purchase.orderId}`);
  } catch (error) {
    console.error('Error handling payment canceled:', error);
  }
};

// Send purchase confirmation email
const sendPurchaseConfirmationEmail = async (purchase) => {
  const emailData = {
    to: purchase.customerInfo.email,
    subject: `Purchase Confirmation - ${purchase.product.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Thank you for your purchase!</h2>
        <p>Hi ${purchase.customerInfo.firstName},</p>
        <p>Your purchase has been confirmed and is ready for download.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Order Details</h3>
          <p><strong>Order ID:</strong> ${purchase.orderId}</p>
          <p><strong>Product:</strong> ${purchase.product.name}</p>
          <p><strong>Amount:</strong> ${purchase.paymentInfo.currency.toUpperCase()} ${(
      purchase.paymentInfo.amount / 100
    ).toFixed(2)}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/download/${purchase.orderId}/${
      purchase.downloadInfo.downloadToken
    }" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Download Your Product
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          If you have any questions, please contact our support team.
        </p>
      </div>
    `,
  };

  // Use your existing email service
  await emailService.sendEmail(emailData);
};
