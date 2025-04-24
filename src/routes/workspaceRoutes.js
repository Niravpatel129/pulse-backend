import express from 'express';
import { addParticipant } from '../controllers/workspace/addParticipant.js';
import { deleteWorkspaceMember } from '../controllers/workspace/deleteWorkspaceMember.js';
import { getClients } from '../controllers/workspace/getClients.js';
import { getTeamMembers } from '../controllers/workspace/getTeamMembers.js';
import { getUser } from '../controllers/workspace/getUser.js';
import { getWorkspaceMembers } from '../controllers/workspace/getWorkspaceMembers.js';
import {
  createWorkspace,
  getWorkspace,
  getWorkspaces,
  updateWorkspace,
} from '../controllers/workspace/index.js';
import { inviteMemberToWorkspace } from '../controllers/workspace/inviteMemberToWorkspace.js';
import { updateWorkspaceMember } from '../controllers/workspace/updateWorkspaceMember.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get('/user/:id', getUser);

router.get('/team', extractWorkspace, getTeamMembers);

router.get('/clients', extractWorkspace, getClients);

// create client
router.post('/clients', extractWorkspace, addParticipant);

// Create a new workspace
router.post('/', createWorkspace);

// Get all workspaces for the authenticated user
router.get('/', getWorkspaces);

// workspace members
router.get('/members', extractWorkspace, getWorkspaceMembers);

// Delete a workspace member
router.delete('/members/:memberId', extractWorkspace, deleteWorkspaceMember);

// Update a workspace member's role
router.put('/members/:memberId', extractWorkspace, updateWorkspaceMember);

// invite user to workspace
router.post('/invite', extractWorkspace, inviteMemberToWorkspace);

// Get a specific workspace
router.get('/:workspaceId', getWorkspace);

// Update a workspace
router.patch('/:workspaceId', updateWorkspace);

// Add a participant to the workspace
router.post('/participants', extractWorkspace, addParticipant);

// Get Team Members

export default router;
