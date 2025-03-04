import express from 'express';
import { createProject } from '../../controllers/project/createProject.js';
import { getProject, getProjects } from '../../controllers/project/index.js';
import { addParticipant } from '../../controllers/project/participants.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/', createProject);

router.get('/', getProjects);

router.get('/:id', getProject);

router.post('/:projectId/participants', addParticipant);

export default router;
