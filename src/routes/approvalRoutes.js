import express from 'express';
import getApprovalDetails from '../controllers/approvals/getApprovalDetails.js';
import getModuleApprovals from '../controllers/approvals/getModuleApprovals.js';
import requestApproval from '../controllers/approvals/requestApproval.js';
import sendApprovalEmail from '../controllers/approvals/sendApprovalEmail.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

// Get all approvals for a module
router.get('/modules/:moduleId', getModuleApprovals);

// Get details for a specific approval
router.get('/:approvalId', getApprovalDetails);

// Request approval for a module
router.post('/modules/:moduleId/request', requestApproval);

// Send approval email for a specific approval request
router.post('/:approvalId/send-email', sendApprovalEmail);

export default router;
