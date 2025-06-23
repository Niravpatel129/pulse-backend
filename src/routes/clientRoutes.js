import express from 'express';
import {
  createClient,
  deleteClient,
  getClient,
  getClients,
  getClientStats,
  updateClient,
  updateClientStatus,
} from '../controllers/client/clientController.js';
import {
  addClientLabel,
  deleteClientLabel,
  getClientLabels,
  updateClientLabels,
} from '../controllers/client/labelController.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Apply authentication and workspace middleware to all routes
router.use(authenticate);
router.use(extractWorkspace);

// Get all clients
router.get('/', getClients);

// Client Labels routes (placed before /:id to avoid route conflicts)
router.get('/:id/labels', getClientLabels);
router.post('/:id/labels', addClientLabel);
router.delete('/:id/labels/:labelName', deleteClientLabel);
router.patch('/:id/labels', updateClientLabels);

// Client Stats route (placed before /:id to avoid route conflicts)
router.get('/:id/stats', getClientStats);

// Get a single client
router.get('/:id', getClient);

// Create a new client
router.post('/', createClient);

// Update a client
router.put('/:id', updateClient);

// Update client status
router.patch('/:id', updateClientStatus);

// Delete a client
router.delete('/:id', deleteClient);

export default router;
