import express from 'express';
import { createClient } from '../controllers/client/createClient.js';
import { deleteClient } from '../controllers/client/deleteClient.js';
import { getClient } from '../controllers/client/getClient.js';
import { getClients } from '../controllers/client/getClients.js';
import { getClientStats } from '../controllers/client/getClientStats.js';
import { getClientTimeline } from '../controllers/client/getClientTimeline.js';
import {
  addClientLabel,
  deleteClientLabel,
  getClientLabels,
  updateClientLabels,
} from '../controllers/client/labelController.js';
import { updateClient } from '../controllers/client/updateClient.js';
import { updateClientStatus } from '../controllers/client/updateClientStatus.js';
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

// Client Timeline route (placed before /:id to avoid route conflicts)
router.get('/:id/timeline', getClientTimeline);

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
