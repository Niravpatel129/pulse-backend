import express from 'express';
import getInboxEmails from '../controllers/inbox/getInboxEmails.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.get('/', getInboxEmails);

export default router;
