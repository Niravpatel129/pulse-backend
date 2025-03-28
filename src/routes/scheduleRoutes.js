import express from 'express';
import getBooking from '../controllers/schedule/getBooking.js';
import scheduleInvite from '../controllers/schedule/scheduleInvite.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.post('/invite', scheduleInvite);
router.get('/booking/:bookingId', getBooking);

export default router;
