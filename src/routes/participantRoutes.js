import express from 'express';
import {
  createParticipant,
  deleteParticipant,
  getAllParticipants,
  getParticipant,
  updateParticipant,
} from '../controllers/participant/participantController.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// All routes require authentication and workspace context
router.use(authenticate);
router.use(extractWorkspace);

// Get all participants
router.get('/', getAllParticipants);

// Get single participant
router.get('/:id', getParticipant);

// Create participant
router.post('/', createParticipant);

// Update participant
router.put('/:id', updateParticipant);

// Delete participant
router.delete('/:id', deleteParticipant);

export default router;
