import express from 'express';
import {
  confirmPaymentSchema,
  createDigitalProductSchema,
  createPaymentIntentSchema,
  getDigitalProductsQuerySchema,
  updateDigitalProductSchema,
} from '../config/validators/digitalProductValidators.js';
import { checkStripeAccountStatus } from '../controllers/digitalProducts/checkStripeAccount.js';
import { confirmPayment } from '../controllers/digitalProducts/confirmPayment.js';
import { createPaymentIntent } from '../controllers/digitalProducts/createPaymentIntent.js';
import { downloadProduct } from '../controllers/digitalProducts/downloadProduct.js';
import {
  getDigitalProduct,
  getDigitalProducts,
} from '../controllers/digitalProducts/getDigitalProducts.js';
import {
  getAllPurchases,
  getPurchase,
  getPurchasesByEmail,
  getPurchaseStats,
} from '../controllers/digitalProducts/getPurchases.js';
import {
  createDigitalProduct,
  deleteDigitalProduct,
  getAllDigitalProductsAdmin,
  updateDigitalProduct,
} from '../controllers/digitalProducts/manageDigitalProducts.js';
import { handleStripeWebhook } from '../controllers/digitalProducts/webhookController.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = express.Router();

// Public routes (no authentication required)
router.get(
  '/products',
  validateRequest({ query: getDigitalProductsQuerySchema }),
  getDigitalProducts,
);
router.get('/products/:id', getDigitalProduct);
router.post(
  '/create-payment-intent',
  validateRequest({ body: createPaymentIntentSchema }),
  createPaymentIntent,
);
router.post('/confirm-payment', validateRequest({ body: confirmPaymentSchema }), confirmPayment);
router.get('/download/:orderId/:token', downloadProduct);
router.get('/purchases/customer/:email', getPurchasesByEmail);
router.get('/stripe-status/:workspaceId', checkStripeAccountStatus);

// Webhook route (should be before authentication middleware)
router.post('/webhook', handleStripeWebhook);

// Protected routes (authentication required)
router.use(authenticate); // Apply authentication middleware to all routes below

// Admin routes for managing digital products
router.get(
  '/admin/products',
  validateRequest({ query: getDigitalProductsQuerySchema }),
  getAllDigitalProductsAdmin,
);
router.post(
  '/admin/products',
  validateRequest({ body: createDigitalProductSchema }),
  createDigitalProduct,
);
router.put(
  '/admin/products/:id',
  validateRequest({ body: updateDigitalProductSchema }),
  updateDigitalProduct,
);
router.delete('/admin/products/:id', deleteDigitalProduct);

// Admin routes for managing purchases
router.get('/admin/purchases', getAllPurchases);
router.get('/admin/purchases/stats', getPurchaseStats);
router.get('/admin/purchases/:orderId', getPurchase);

export default router;
