import express from 'express';
import {
  createClient,
  deleteClient,
  getClient,
  getClientByUserAndWorkspace,
  getClientsByWorkspace,
  updateClient,
} from '../controllers/workspace/clientController.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

// Create a new client
router.post('/', createClient);

// Get a specific client by ID
router.get('/:id', getClient);

// Update a client
router.put('/:id', updateClient);

// Delete a client
router.delete('/:id', deleteClient);

// Get all clients for a specific workspace
router.get('/workspace/:workspaceId', getClientsByWorkspace);

// Get client by user and workspace
router.get('/user/:userId/workspace/:workspaceId', getClientByUserAndWorkspace);

export default router;
