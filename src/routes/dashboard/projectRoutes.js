import express from 'express';
import { createProject } from '../../controllers/project/createProject.js';
import { deleteProject } from '../../controllers/project/deleteProject.js';
import { getProject } from '../../controllers/project/getProject.js';
import { getProjects } from '../../controllers/project/getProjects.js';
import { addParticipant } from '../../controllers/project/participants.js';
import { authenticate } from '../../middleware/auth.js';
import { extractWorkspace } from '../../middleware/workspace.js';

const router = express.Router();

// All routes require authentication and workspace context
router.use(authenticate);
router.use(extractWorkspace);

router.post('/', createProject);

router.get('/', getProjects);

router.get('/:id', getProject);

router.delete('/:id', deleteProject);
router.post('/:projectId/participants', addParticipant);

export default router;
