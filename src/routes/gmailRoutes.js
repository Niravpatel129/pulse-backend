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

// Apply authentication and workspace middleware to all routes
router.use(authenticate);
router.use(extractWorkspace);

// Gmail integration routes
router.get('/auth-url', getAuthUrl);
router.post('/connect', connectGmail);
router.post('/disconnect', disconnectGmail);
router.get('/status', getGmailStatus);
router.post('/set-primary', setPrimaryGmail);
router.get('/emails', getGmailEmails);

export default router;
