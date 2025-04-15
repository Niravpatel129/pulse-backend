import express from 'express';
import addModuleToProject from '../controllers/project-modules/addModuleToProject.js';
import addTemplatedModuleToProject from '../controllers/project-modules/addTemplatedModuleToProject.js';
import deleteModuleFromProject from '../controllers/project-modules/deleteModuleFromProject.js';
import duplicateModule from '../controllers/project-modules/duplicateModule.js';
import getAllProjectModules from '../controllers/project-modules/getAllProjectModules.js';
import getModuleDetails from '../controllers/project-modules/getModuleDetails.js';
import getProjectModules from '../controllers/project-modules/getProjectModules.js';
import restoreModuleVersion from '../controllers/project-modules/restoreModuleVersion.js';
import updateModuleDetails from '../controllers/project-modules/updateModuleDetails.js';
import updateModuleFigma from '../controllers/project-modules/updateModuleFigma.js';
import updateModuleFile from '../controllers/project-modules/updateModuleFile.js';
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
router.patch('/:moduleId/file', updateModuleFile);
router.patch('/:moduleId/figma', updateModuleFigma);
router.delete('/:moduleId', deleteModuleFromProject);

router.get('/:projectId', getProjectModules);
router.get('/', getAllProjectModules);
router.get('/module/:moduleId', getModuleDetails);

router.patch('/:moduleId/restore-version', restoreModuleVersion);

router.post('/:moduleId/duplicate', duplicateModule);

export default router;
