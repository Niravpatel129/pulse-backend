import express from 'express';
import {
  deleteReader,
  getConnectionToken,
  listReaders,
  registerReader,
  syncReader,
  updateReader,
} from '../controllers/pos/index.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

// Protect all routes
router.use(authenticate);

// Reader management routes
router.post('/register-reader', registerReader);
router.get('/readers', listReaders);
router.get('/readers/:readerId/sync', syncReader);
router.patch('/readers/:readerId', updateReader);
router.delete('/readers/:readerId', deleteReader);

// Connection token route
router.post('/connection-token', getConnectionToken);

export default router;
