import express from 'express';
import scheduleInvite from '../controllers/schedule/scheduleInvite.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.post('/invite', scheduleInvite);
export default router;
