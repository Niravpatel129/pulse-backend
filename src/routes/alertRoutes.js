import express from 'express';
import { processEmailAction } from '../controllers/alerts/emailActionController.js';
import {
  dismissAlert,
  getProjectAlerts,
  getUserAlerts,
  resolveAlert,
} from '../controllers/alerts/projectAlertController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes for email actions
router.get('/:alertId/resolve', processEmailAction);
router.get('/:alertId/dismiss', processEmailAction);

// Protected routes
router.use(protect);

// Get all alerts for the current user's projects
router.get('/user', getUserAlerts);

// Get alerts for a specific project
router.get('/project/:projectId', getProjectAlerts);

// Resolve an alert (mark as handled)
router.post('/:alertId/resolve', resolveAlert);

// Dismiss an alert (just hide it)
router.post('/:alertId/dismiss', dismissAlert);

export default router;
