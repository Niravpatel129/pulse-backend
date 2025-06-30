import express, { Router } from 'express';
import stripe from '../config/stripe.js';
import { handleStripeWebhook } from '../controllers/digitalProducts/webhookController.js';

// Raw body middleware that preserves the original body for signature verification
const rawBodyMiddleware = (req, res, next) => {
  if (req.headers['content-type'] === 'application/json') {
    let data = '';
    req.setEncoding('utf8');

    req.on('data', (chunk) => {
      data += chunk;
    });

    req.on('end', () => {
      req.rawBody = data;
      try {
        req.body = JSON.parse(data);
      } catch (e) {
        req.body = data;
      }
      next();
    });
  } else {
    next();
  }
};

// Alternative approach using express.raw with verify callback
const rawBodySaver = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString('utf8');
  }
};

// Event parser middleware factory
function eventParser(secret) {
  return (req, res, next) => {
    try {
      if (!secret) {
        console.error('❌ Webhook secret is not configured');
        return res.status(400).json({ error: 'Webhook secret is not set' });
      }

      const sig = req.headers['stripe-signature'];

      if (!sig) {
        console.error('❌ No stripe-signature header found');
        return res.status(400).json({ error: 'Missing stripe-signature header' });
      }

      // Use the rawBody we captured
      const rawBody = req.rawBody;

      if (!rawBody) {
        console.error('❌ Raw body is missing');
        return res.status(400).json({ error: 'Missing raw request body' });
      }

      console.log('🔍 Webhook verification details:');
      console.log('- Secret configured:', !!secret);
      console.log('- Secret format:', secret.substring(0, 8) + '...');
      console.log('- Secret length:', secret.length);
      console.log('- Full secret (for debugging):', secret);
      console.log('- Signature header present:', !!sig);
      console.log('- Signature value:', sig);
      console.log('- Raw body type:', typeof rawBody);
      console.log('- Raw body length:', rawBody.length);
      console.log('- First 200 chars of raw body:', rawBody.substring(0, 200));
      console.log('- Last 100 chars of raw body:', rawBody.substring(rawBody.length - 100));

      // Construct and verify the Stripe event using the raw body string
      const event = stripe.webhooks.constructEvent(rawBody, sig, secret);

      // Replace the body with the parsed event
      req.body = event;
      req.stripeEvent = event;

      console.log(`✅ Webhook verified successfully: ${event.type} (ID: ${event.id})`);
      next();
    } catch (error) {
      console.error('❌ Webhook signature verification failed:', error.message);
      console.error('Error details:', {
        message: error.message,
        type: error.constructor.name,
        rawBodyLength: req.rawBody ? req.rawBody.length : 'undefined',
        signaturePresent: !!req.headers['stripe-signature'],
      });
      return res.status(400).json({
        error: `Webhook Error: ${error.message}`,
        details: 'Signature verification failed - check webhook secret and payload',
      });
    }
  };
}

// Stripe webhook router with proper raw body handling
export default Router()
  // Method 1: Use express.raw with verify callback to capture raw body
  .use(
    express.raw({
      type: 'application/json',
      limit: '50mb',
      verify: rawBodySaver,
    }),
  )

  // Digital products webhooks
  .post('/digital-products', eventParser(process.env.STRIPE_WEBHOOK_SECRET), handleStripeWebhook)

  // Connect webhooks (for future use)
  .post('/connect', eventParser(process.env.STRIPE_WEBHOOK_CONNECT_SECRET), handleStripeWebhook)

  // Health check with detailed diagnostics
  .get('/health', (req, res) => {
    res.json({
      status: 'Stripe webhook service healthy',
      timestamp: new Date().toISOString(),
      env_check: {
        webhook_secret_configured: !!process.env.STRIPE_WEBHOOK_SECRET,
        webhook_secret_format: process.env.STRIPE_WEBHOOK_SECRET
          ? process.env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')
            ? 'correct'
            : 'incorrect format'
          : 'not configured',
        webhook_secret_length: process.env.STRIPE_WEBHOOK_SECRET
          ? process.env.STRIPE_WEBHOOK_SECRET.length
          : 0,
        connect_secret_configured: !!process.env.STRIPE_WEBHOOK_CONNECT_SECRET,
        connect_secret_format: process.env.STRIPE_WEBHOOK_CONNECT_SECRET
          ? process.env.STRIPE_WEBHOOK_CONNECT_SECRET.startsWith('whsec_')
            ? 'correct'
            : 'incorrect format'
          : 'not configured',
      },
      endpoints: {
        digital_products: '/api/stripe-webhooks/digital-products',
        connect: '/api/stripe-webhooks/connect',
      },
      middleware_info: {
        raw_body_parser: 'express.raw with verify callback',
        content_type: 'application/json',
        body_limit: '50mb',
      },
    });
  });
