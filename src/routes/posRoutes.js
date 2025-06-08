import express from 'express';
import {
  cancelPaymentIntent,
  checkPaymentStatus,
  createAndProcessPayment,
  createLocation,
  deleteReader,
  getConnectionToken,
  listLocations,
  listReaders,
  registerReader,
  syncReader,
  updateReader,
} from '../controllers/pos/index.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router({ mergeParams: true });

// Protect all routes
router.use(authenticate);
router.use(extractWorkspace);

// Reader management routes
router.post('/register-reader', registerReader);
router.get('/readers', listReaders);
router.get('/readers/:readerId/sync', syncReader);
router.patch('/readers/:readerId', updateReader);
router.delete('/readers/:readerId', deleteReader);

// Location management routes
router.post('/locations', createLocation);
router.get('/locations', listLocations);

// Connection token route
router.post('/connection-token', getConnectionToken);

// Payment processing routes
router.post('/payment-intent', createAndProcessPayment);
router.get('/payment-status', checkPaymentStatus);
router.post('/cancel-payment-intent', cancelPaymentIntent);

export default router;
