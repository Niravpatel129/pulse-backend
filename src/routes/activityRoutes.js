import express from 'express';
import { createActivity } from '../controllers/activity/createActivity.js';
import { getRecentActivities } from '../controllers/activity/getRecentActivities.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Apply authentication and workspace middleware to all routes
router.use(authenticate);
router.use(extractWorkspace);

// Create a new activity
router.post('/', createActivity);

// Get recent activities for a user
router.get('/recent/:userId', getRecentActivities);

export default router;
