import express from 'express';

import generateProjectInvoiceItems from '../controllers/project-invoices/generateProjectInvoiceItems.js';
import getProjectInvoice from '../controllers/project-invoices/getProjectInvoice.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.get('/generate/:projectId', generateProjectInvoiceItems);
router.get('/:projectId', getProjectInvoice);

export default router;
