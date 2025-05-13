import express from 'express';
import { acceptWorkspaceInvitation } from '../controllers/workspace/acceptInvitation.js';
import { addParticipant } from '../controllers/workspace/addParticipant.js';
import { deleteWorkspaceMember } from '../controllers/workspace/deleteWorkspaceMember.js';
import { getClients } from '../controllers/workspace/getClients.js';
import { getTeamMembers } from '../controllers/workspace/getTeamMembers.js';
import { getUser } from '../controllers/workspace/getUser.js';
import { getWorkspaceLogo } from '../controllers/workspace/getWorkspaceLogo.js';
import { getWorkspaceMembers } from '../controllers/workspace/getWorkspaceMembers.js';
import {
  createWorkspace,
  getWorkspace,
  getWorkspaces,
  handleWorkspaceFileUpload,
  updateWorkspace,
} from '../controllers/workspace/index.js';
import { inviteMemberToWorkspace } from '../controllers/workspace/inviteMemberToWorkspace.js';
import { revokeWorkspaceInvitation } from '../controllers/workspace/revokeInvitation.js';
import { updateWorkspaceMember } from '../controllers/workspace/updateWorkspaceMember.js';
import { verifyWorkspaceInvitation } from '../controllers/workspace/verifyInvitation.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/invite/verify/:token', verifyWorkspaceInvitation);
router.post('/invite/accept/:token', acceptWorkspaceInvitation);

router.get('/workspace-logo', extractWorkspace, getWorkspaceLogo);

// All routes below require authentication
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

// revoke workspace invitation
router.delete('/invite/:inviteId', extractWorkspace, revokeWorkspaceInvitation);

// Get a specific workspace
router.get('/current-workspace', extractWorkspace, getWorkspace);

// Update a workspace (supports both PUT and PATCH)
router.patch('/:workspaceId', extractWorkspace, updateWorkspace);
// Added for multipart/form-data support with logo uploads
router.put('/:workspaceId', extractWorkspace, handleWorkspaceFileUpload, updateWorkspace);

// Add a participant to the workspace
router.post('/participants', extractWorkspace, addParticipant);

// Get Team Members

export default router;
