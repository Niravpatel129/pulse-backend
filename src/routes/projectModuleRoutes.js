import express from 'express';
import addModuleToProject from '../controllers/project-modules/addModuleToProject.js';
import addTemplatedModuleToProject from '../controllers/project-modules/addTemplatedModuleToProject.js';
import deleteModuleFromProject from '../controllers/project-modules/deleteModuleFromProject.js';
import getProjectModules from '../controllers/project-modules/getProjectModules.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.post('/templated-module/:projectId', addTemplatedModuleToProject);
router.post('/', addModuleToProject);

router.delete('/:moduleId', deleteModuleFromProject);

router.get('/:projectId', getProjectModules);

export default router;
