import express from 'express';

import { createPaymentIntent } from '../controllers/stripe/createPaymentIntent.js';
import { createStripeAccount } from '../controllers/stripe/createStripeAccount.js';
import { getBalance } from '../controllers/stripe/getBalance.js';
import { getPaymentTimeline } from '../controllers/stripe/getPaymentTimeline.js';
import { getStripeAccountStatus } from '../controllers/stripe/getStripeAccountStatus.js';
import { verifyPayment } from '../controllers/stripe/verifyPayment.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Apply authentication and workspace middleware to all routes
router.post('/payment-intent', createPaymentIntent);
router.post('/verify-payment', verifyPayment);

router.use(authenticate);
router.use(extractWorkspace);

// Stripe Connect routes
router.post('/connect/create-account', createStripeAccount);
router.get('/connect/account-status', getStripeAccountStatus);

// Payment routes
router.get('/balance', getBalance);
router.get('/payments/:paymentId/timeline', getPaymentTimeline);

export default router;
