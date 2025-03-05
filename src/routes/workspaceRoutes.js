import express from 'express';
import {
  createWorkspace,
  getWorkspace,
  getWorkspaces,
  updateWorkspace,
} from '../controllers/workspace/index.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create a new workspace
router.post('/', createWorkspace);

// Get all workspaces for the authenticated user
router.get('/', getWorkspaces);

// Get a specific workspace
router.get('/:workspaceId', getWorkspace);

// Update a workspace
router.patch('/:workspaceId', updateWorkspace);

export default router;
