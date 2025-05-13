import express from 'express';
import {
  createPayment,
  deletePayment,
  getPaymentById,
  getPayments,
  getPaymentsByClient,
  getPaymentsByInvoice,
  processPayment,
  refundPayment,
  updatePayment,
} from '../controllers/payment/paymentController.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';
const router = express.Router();

// public get payment by payment id
router.get('/:id', getPaymentById);

// Protect all routes
router.use(authenticate);
router.use(extractWorkspace);

// Basic CRUD routes
router.route('/').get(getPayments).post(createPayment);

router.route('/:id').get(getPaymentById).put(updatePayment).delete(deletePayment);

// Payment specific routes
router.get('/invoice/:invoiceId', getPaymentsByInvoice);
router.get('/client/:clientId', getPaymentsByClient);
router.post('/:id/process', processPayment);
router.post('/:id/refund', refundPayment);

export default router;
