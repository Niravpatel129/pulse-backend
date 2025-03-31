import express from 'express';
import bookMeeting from '../controllers/schedule/bookMeeting.js';
import confirmBooking from '../controllers/schedule/confirmBooking.js';
import getBooking from '../controllers/schedule/getBooking.js';
import getSchedule from '../controllers/schedule/getSchedule.js';
import scheduleInvite from '../controllers/schedule/scheduleInvite.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.post('/invite', scheduleInvite);
router.post('/book', bookMeeting);
router.get('/booking/:bookingId', getBooking);
router.get('/', getSchedule);
router.post('/booking/:bookingId/confirm', confirmBooking);

export default router;
