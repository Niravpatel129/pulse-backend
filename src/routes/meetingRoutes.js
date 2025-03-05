import express from 'express';
import {
  createMeeting,
  deleteMeeting,
  getMeeting,
  getMeetings,
  updateMeeting,
  updateMeetingStatus,
} from '../controllers/meetingControllers/index.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected and require authentication
// router.use(protect);
router.use(authenticate);

router.route('/').get(getMeetings).post(createMeeting);

router.route('/:id').get(getMeeting).put(updateMeeting).delete(deleteMeeting);

router.route('/:id/status').patch(updateMeetingStatus);

export default router;
