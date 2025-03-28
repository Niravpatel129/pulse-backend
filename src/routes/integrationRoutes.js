import express from 'express';
import disconnectGoogle from '../controllers/integrations/google/disconnectGoogle.js';
import getGoogleStatus from '../controllers/integrations/google/getGoogleStatus.js';
import handleGoogleCallback from '../controllers/integrations/google/handleGoogleCallback.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

// Google integrations routes
router.get('/google/status', getGoogleStatus);
router.post('/google/callback', handleGoogleCallback);
router.post('/google/disconnect', disconnectGoogle);

export default router;
