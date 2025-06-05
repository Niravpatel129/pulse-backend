import express from 'express';
import { archiveThread } from '../controllers/inbox/archiveThread.js';
import getInboxEmailById from '../controllers/inbox/getInboxEmailById.js';
import getInboxEmails from '../controllers/inbox/getInboxEmails.js';
import { markAsSpam } from '../controllers/inbox/markAsSpam.js';
import { moveToTrash } from '../controllers/inbox/moveToTrash.js';
import { summarizeThread } from '../controllers/inbox/summarizeThread.js';
import { updateReadStatus } from '../controllers/inbox/updateReadStatus.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.get('/', getInboxEmails);
router.get('/:id', getInboxEmailById);
router.post('/:threadId/read-status', updateReadStatus);
router.post('/:threadId/trash', moveToTrash);
router.post('/:threadId/spam', markAsSpam);
router.post('/:threadId/archive', archiveThread);
router.post('/:threadId/summarize', summarizeThread);

export default router;
