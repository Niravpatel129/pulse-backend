import express from 'express';
import createModuleTemplate from '../controllers/module-templates/createModuleTemplate.js';
import getModuleTemplates from '../controllers/module-templates/getModuleTemplates.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.get('/', getModuleTemplates);
router.post('/', createModuleTemplate);
export default router;
