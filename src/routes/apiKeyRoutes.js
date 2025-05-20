import express from 'express';
import { createApiKey } from '../controllers/apiKey/createApiKey.js';
import { listApiKeys } from '../controllers/apiKey/listApiKeys.js';
import { revokeApiKey } from '../controllers/apiKey/revokeApiKey.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate, extractWorkspace);

// Get all API keys for workspace
router.get('/', listApiKeys);

// Create new API key
router.post('/', createApiKey);

// Revoke API key
router.delete('/:id', revokeApiKey);

export default router;
