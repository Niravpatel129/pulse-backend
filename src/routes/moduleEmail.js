import express from 'express';
import { getModuleEmails } from '../controllers/email/getModuleEmails.js';
import { sendApprovalEmail } from '../controllers/email/sendApprovalEmail.js';
import { updateEmailStatus } from '../controllers/email/updateEmailStatus.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.post('/send-approval-email', sendApprovalEmail);
router.get('/:moduleId/approvals', getModuleEmails);
router.patch('/:emailId/status', updateEmailStatus);

export default router;
