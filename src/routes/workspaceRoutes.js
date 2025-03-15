import express from 'express';
import { getWorkspaceMembers } from '../controllers/workspace/getWorkspaceMembers.js';
import {
  createWorkspace,
  getWorkspace,
  getWorkspaces,
  updateWorkspace,
} from '../controllers/workspace/index.js';
import { inviteMemberToWorkspace } from '../controllers/workspace/inviteMemberToWorkspace.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create a new workspace
router.post('/', createWorkspace);

// Get all workspaces for the authenticated user
router.get('/', getWorkspaces);

// workspace members
router.get('/members', extractWorkspace, getWorkspaceMembers);

// invite user to workspace
router.post('/invite', extractWorkspace, inviteMemberToWorkspace);

// Get a specific workspace
router.get('/:workspaceId', getWorkspace);

// Update a workspace
router.patch('/:workspaceId', updateWorkspace);

export default router;
