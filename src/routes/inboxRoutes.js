import express from 'express';
import multer from 'multer';
import validateRequest from '../config/middleware/validateRequest.js';
import { sendInboxEmail as sendInboxEmailSchema } from '../config/validators/inboxValidators.js';
import { archiveThread } from '../controllers/inbox/archiveThread.js';
import getInboxEmailById from '../controllers/inbox/getInboxEmailById.js';
import getInboxEmails from '../controllers/inbox/getInboxEmails.js';
import { getInboxHeaders } from '../controllers/inbox/getInboxHeaders.js';
import { markAsSpam } from '../controllers/inbox/markAsSpam.js';
import { moveToTrash } from '../controllers/inbox/moveToTrash.js';
import { sendInboxEmail } from '../controllers/inbox/sendInboxEmail.js';
import { summarizeThread } from '../controllers/inbox/summarizeThread.js';
import { updateReadStatus } from '../controllers/inbox/updateReadStatus.js';
import { updateThreadStage } from '../controllers/inbox/updateThreadStage.js';
import { updateThreadSubject } from '../controllers/inbox/updateThreadSubject.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Configure multer for handling multipart/form-data
const upload = multer();

router.use(authenticate);
router.use(extractWorkspace);

router.get('/', getInboxEmails);
router.get('/inbox-headers', getInboxHeaders);
router.get('/:id', getInboxEmailById);

router.post('/:threadId/read-status', updateReadStatus);
router.post('/:threadId/trash', moveToTrash);
router.post('/:threadId/spam', markAsSpam);
router.post('/:threadId/archive', archiveThread);
router.post('/:threadId/summarize', summarizeThread);
router.post('/:threadId/stage', updateThreadStage);
router.post('/:threadId/subject', updateThreadSubject);
router.post(
  '/send-email',
  upload.array('attachments'),
  validateRequest(sendInboxEmailSchema),
  sendInboxEmail,
);

export default router;
