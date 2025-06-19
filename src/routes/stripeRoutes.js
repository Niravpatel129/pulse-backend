import express from 'express';

import { createPaymentIntent } from '../controllers/stripe/createPaymentIntent.js';
import { createStripeAccount } from '../controllers/stripe/createStripeAccount.js';
import { disconnectStripeAccount } from '../controllers/stripe/disconnectStripeAccount.js';
import { getBalance } from '../controllers/stripe/getBalance.js';
import { getPaymentTimeline } from '../controllers/stripe/getPaymentTimeline.js';
import { getStripeAccountStatus } from '../controllers/stripe/getStripeAccountStatus.js';
import { paymentFailed } from '../controllers/stripe/paymentFailed.js';
import { verifyPayment } from '../controllers/stripe/verifyPayment.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/payment-intent', createPaymentIntent);
router.post('/verify-payment', verifyPayment);
router.post('/payment-failed', paymentFailed);

// Protected routes
router.use(authenticate);
router.use(extractWorkspace);

// Stripe Connect routes
router.post('/connect/create-account', createStripeAccount);
router.get('/connect/account-status', getStripeAccountStatus);
router.post('/connect/disconnect', disconnectStripeAccount);

// Payment routes
router.get('/balance', getBalance);
router.get('/payments/:paymentId/timeline', getPaymentTimeline);

export default router;
