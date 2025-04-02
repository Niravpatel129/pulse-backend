import express from 'express';
import addModuleToProject from '../controllers/project-modules/addModuleToProject.js';
import getProjectModules from '../controllers/project-modules/getProjectModules.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.post('/', addModuleToProject);

router.get('/:projectId', getProjectModules);

export default router;
