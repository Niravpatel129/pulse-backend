import express from 'express';
import {
  createPaymentIntent,
  createStripeAccount,
  getBalance,
  getStripeAccountStatus,
} from '../controllers/stripe/stripeController.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Apply authentication and workspace middleware to all routes
router.use(authenticate);
router.use(extractWorkspace);

// Stripe Connect routes
router.post('/connect/create-account', createStripeAccount);
router.get('/connect/account-status', getStripeAccountStatus);

// Payment routes
router.post('/payment-intent', createPaymentIntent);
router.get('/balance', getBalance);

export default router;
