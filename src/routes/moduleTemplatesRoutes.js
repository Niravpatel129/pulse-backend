import express from 'express';
import createModuleTemplate from '../controllers/module-templates/createModuleTemplate.js';
import deleteModuleTemplate from '../controllers/module-templates/deleteModuleTemplate.js';
import getModuleTemplateById from '../controllers/module-templates/getModuleTemplateById.js';
import getModuleTemplates from '../controllers/module-templates/getModuleTemplates.js';
import updateModuleTemplate from '../controllers/module-templates/updateModuleTemplate.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.get('/', getModuleTemplates);
router.get('/:id', getModuleTemplateById);
router.post('/', createModuleTemplate);
router.delete('/:id', deleteModuleTemplate);
router.put('/:id', updateModuleTemplate);
export default router;
