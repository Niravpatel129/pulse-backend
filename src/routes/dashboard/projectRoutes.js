import express from 'express';
import { createProject } from '../../controllers/project/createProject.js';
import { getProject, getProjects } from '../../controllers/project/index.js';
import { authenticate } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/', createProject);

router.get('/', getProjects);

router.get('/:id', getProject);

export default router;
