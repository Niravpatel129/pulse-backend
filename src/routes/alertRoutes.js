import express from 'express';
import { protect } from '../config/middleware/auth.js';
import { processEmailAction } from '../controllers/alerts/emailActionController.js';
import {
  dismissAlert,
  getProjectAlerts,
  getProjectBadges,
  getUserAlerts,
  getUserBadges,
  remindProject,
  resolveAlert,
} from '../controllers/alerts/projectAlertController.js';

const router = express.Router();

// Public routes for email actions
router.get('/:alertId/resolve', processEmailAction);
router.get('/:alertId/dismiss', processEmailAction);

// Protected routes
router.use(protect);

// Get all alerts for the current user's projects
router.get('/user', getUserAlerts);

// Get all badge notifications for the current user's projects
router.get('/user/badges', getUserBadges);

// Get alerts for a specific project
router.get('/project/:projectId', getProjectAlerts);

// Get badges for a specific project
router.get('/project/:projectId/badges', getProjectBadges);

// Set a reminder for a project
router.post('/project/:alertId/remind', remindProject);

// Resolve an alert (mark as handled)
router.post('/:alertId/resolve', resolveAlert);

// Dismiss an alert (just hide it)
router.post('/:alertId/dismiss', dismissAlert);

export default router;
