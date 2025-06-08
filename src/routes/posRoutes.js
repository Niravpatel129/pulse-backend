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
router.post('/:workspaceId/register-reader', registerReader);
router.get('/:workspaceId/readers', listReaders);
router.get('/:workspaceId/readers/:readerId/sync', syncReader);
router.patch('/:workspaceId/readers/:readerId', updateReader);
router.delete('/:workspaceId/readers/:readerId', deleteReader);

// Connection token route
router.post('/:workspaceId/connection-token', getConnectionToken);

export default router;
