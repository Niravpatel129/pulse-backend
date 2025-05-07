import express from 'express';
import {
  createClient,
  deleteClient,
  getClient,
  getClients,
  updateClient,
} from '../controllers/client/clientController.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Apply authentication and workspace middleware to all routes
router.use(authenticate);
router.use(extractWorkspace);

// Get all clients
router.get('/', getClients);

// Get a single client
router.get('/:id', getClient);

// Create a new client
router.post('/', createClient);

// Update a client
router.put('/:id', updateClient);

// Delete a client
router.delete('/:id', deleteClient);

export default router;
