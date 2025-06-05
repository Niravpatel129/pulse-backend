import express from 'express';
import getInboxEmailById from '../controllers/inbox/getInboxEmailById.js';
import getInboxEmails from '../controllers/inbox/getInboxEmails.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.get('/', getInboxEmails);
router.get('/:id', getInboxEmailById);

export default router;
