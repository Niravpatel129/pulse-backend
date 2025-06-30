import bodyParser from 'body-parser';
import { Router } from 'express';
import stripe from '../config/stripe.js';
import { handleStripeWebhook } from '../controllers/digitalProducts/webhookController.js';

// Event parser middleware factory
function eventParser(secret) {
  return (req, res, next) => {
    try {
      // Construct and verify the Stripe event
      req.body = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret);
      console.log(`✅ Webhook verified: ${req.body.type}`);
      next();
    } catch (error) {
      console.error('❌ Webhook signature verification failed:', error.message);
      return res.status(400).json({ error: `Webhook Error: ${error.message}` });
    }
  };
}

// Stripe webhook router with dedicated middleware stack
export default Router()
  // Apply raw body parser to ALL routes in this router
  .use(bodyParser.raw({ type: 'application/json' }))

  // Digital products webhooks
  .post('/digital-products', eventParser(process.env.STRIPE_WEBHOOK_SECRET), handleStripeWebhook)

  // Connect webhooks (for future use)
  .post('/connect', eventParser(process.env.STRIPE_WEBHOOK_CONNECT_SECRET), handleStripeWebhook)

  // Health check
  .get('/health', (req, res) => {
    res.json({
      status: 'Stripe webhook service healthy',
      timestamp: new Date().toISOString(),
    });
  });
