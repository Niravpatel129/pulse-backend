import express from 'express';
import createModuleTemplate from '../controllers/module-templates/createModuleTemplate.js';
import deleteModuleTemplate from '../controllers/module-templates/deleteModuleTemplate.js';
import getModuleTemplateById from '../controllers/module-templates/getModuleTemplateById.js';
import getModuleTemplates from '../controllers/module-templates/getModuleTemplates.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.get('/', getModuleTemplates);
router.get('/:id', getModuleTemplateById);
router.post('/', createModuleTemplate);
router.delete('/:id', deleteModuleTemplate);
export default router;
