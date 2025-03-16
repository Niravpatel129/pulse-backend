import express from 'express';
import { projectSharingSchema } from '../../config/validators/projectValidators.js';
import { addCollaborator } from '../../controllers/project/addCollaborator.js';
import { addTeamMember } from '../../controllers/project/addTeamMember.js';
import { createProject } from '../../controllers/project/createProject.js';
import { deleteCollaborator } from '../../controllers/project/deleteCollaborator.js';
import { deleteParticipant } from '../../controllers/project/deleteParticipant.js';
import { deleteProject } from '../../controllers/project/deleteProject.js';
import { deleteTeamMember } from '../../controllers/project/deleteTeamMember.js';
import { getCollaborators } from '../../controllers/project/getCollaborators.js';
import { getParticipants } from '../../controllers/project/getParticipants.js';
import { getProject } from '../../controllers/project/getProject.js';
import { getProjects } from '../../controllers/project/getProjects.js';
import { getTeam } from '../../controllers/project/getTeam.js';
import { addParticipant } from '../../controllers/project/participants.js';
import { patchProject } from '../../controllers/project/patchProject.js';
import { getProjectSharing, updateProjectSharing } from '../../controllers/project/sharing.js';
import { updateProject } from '../../controllers/project/updateProject.js';
import { authenticate } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { extractWorkspace } from '../../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

// Project sharing routes
router.get('/:projectId/sharing/settings', getProjectSharing);
router.put(
  '/:projectId/sharing/settings',
  validateRequest(projectSharingSchema),
  updateProjectSharing,
);

// Project CRUD routes
router.post('/', createProject);
router.get('/', getProjects);
router.get('/:id', getProject);
router.put('/:id', updateProject);
router.patch('/:id', patchProject);
router.delete('/:id', deleteProject);

// Project participants routes
router.post('/:projectId/participants', addParticipant);
router.get('/:projectId/participants', getParticipants);
router.delete('/:projectId/participants/:participantId', deleteParticipant);

// Project collaborators routes
router.post('/:projectId/collaborator', addCollaborator);
router.get('/:projectId/collaborators', getCollaborators);
router.delete('/:projectId/collaborators/:collaboratorId', deleteCollaborator);

// Project team routes
router.get('/:projectId/team', getTeam);
router.post('/:projectId/team', addTeamMember);
router.delete('/:projectId/team/:teamMemberId', deleteTeamMember);

export default router;
