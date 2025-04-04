import express from 'express';
import addModuleToProject from '../controllers/project-modules/addModuleToProject.js';
import addTemplatedModuleToProject from '../controllers/project-modules/addTemplatedModuleToProject.js';
import deleteModuleFromProject from '../controllers/project-modules/deleteModuleFromProject.js';
import getModuleDetails from '../controllers/project-modules/getModuleDetails.js';
import getProjectModules from '../controllers/project-modules/getProjectModules.js';
import updateModuleDetails from '../controllers/project-modules/updateModuleDetails.js';
import updateProjectModule from '../controllers/project-modules/updateProjectModule.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.post('/templated-module/:projectId', addTemplatedModuleToProject);
router.post('/', addModuleToProject);

router.put('/templated-module/:moduleId', updateProjectModule);
router.patch('/:moduleId', updateModuleDetails);
router.delete('/:moduleId', deleteModuleFromProject);

router.get('/:projectId', getProjectModules);
router.get('/module/:moduleId', getModuleDetails);

export default router;
