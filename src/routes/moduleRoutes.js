import express from 'express';
import {
  createModule,
  deleteModule,
  getModule,
  getModules,
  updateModule,
  updateModuleOrder,
} from '../controllers/moduleController.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Apply workspace access check to all routes
router.use(extractWorkspace);

// Module routes
router.post('/', createModule);
router.get('/project/:projectId', getModules);
router.get('/:id', getModule);
router.put('/:id', updateModule);
router.delete('/:id', deleteModule);
router.put('/reorder', updateModuleOrder);

export default router;
