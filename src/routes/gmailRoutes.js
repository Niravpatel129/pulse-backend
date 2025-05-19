import express from 'express';
import connectGmail from '../controllers/integrations/gmail/connectGmail.js';
import disconnectGmail from '../controllers/integrations/gmail/disconnectGmail.js';
import getAuthUrl from '../controllers/integrations/gmail/getAuthUrl.js';
import getGmailEmails from '../controllers/integrations/gmail/getGmailEmails.js';
import getGmailStatus from '../controllers/integrations/gmail/getGmailStatus.js';
import setPrimaryGmail from '../controllers/integrations/gmail/setPrimaryGmail.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(extractWorkspace);

// Gmail integration routes
router.get('/auth-url', authenticate, getAuthUrl);
router.post('/connect', connectGmail);
router.post('/disconnect', authenticate, disconnectGmail);
router.get('/status', authenticate, getGmailStatus);
router.post('/set-primary', authenticate, setPrimaryGmail);
router.get('/emails', authenticate, getGmailEmails);

export default router;
