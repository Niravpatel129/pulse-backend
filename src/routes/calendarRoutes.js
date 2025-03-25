import express from 'express';
import disconnectGoogle from '../controllers/calendar/disconnectGoogle.js';
import getGoogleStatus from '../controllers/calendar/getGoogleStatus.js';
import handleGoogleCallback from '../controllers/calendar/handleGoogleCallback.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.post('/google/callback', handleGoogleCallback);
router.post('/google/disconnect', disconnectGoogle);
router.get('/google/status', getGoogleStatus);

export default router;
