import express from 'express';
import {
  createNewsletterSignupValidation,
  deleteNewsletterSignupValidation,
  getNewsletterSignupsValidation,
  getNewsletterStatsValidation,
  unsubscribeNewsletterValidation,
} from '../config/validators/newsletterValidators.js';
import createNewsletterSignup from '../controllers/newsletter/createNewsletterSignup.js';
import deleteNewsletterSignup from '../controllers/newsletter/deleteNewsletterSignup.js';
import exportNewsletterSignups from '../controllers/newsletter/exportNewsletterSignups.js';
import getNewsletterSignups from '../controllers/newsletter/getNewsletterSignups.js';
import getNewsletterStats from '../controllers/newsletter/getNewsletterStats.js';
import getSubscriberSummary from '../controllers/newsletter/getSubscriberSummary.js';
import unsubscribeNewsletter from '../controllers/newsletter/unsubscribeNewsletter.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/signup', createNewsletterSignupValidation, createNewsletterSignup);
router.post('/unsubscribe', unsubscribeNewsletterValidation, unsubscribeNewsletter);

// Protected routes (authentication and workspace required)
router.get('/subscribers/summary', authenticate, extractWorkspace, getSubscriberSummary);
router.get(
  '/subscribers',
  authenticate,
  extractWorkspace,
  getNewsletterSignupsValidation,
  getNewsletterSignups,
);
router.get(
  '/signups',
  authenticate,
  extractWorkspace,
  getNewsletterSignupsValidation,
  getNewsletterSignups,
);
router.get(
  '/stats',
  authenticate,
  extractWorkspace,
  getNewsletterStatsValidation,
  getNewsletterStats,
);
router.get('/export', authenticate, extractWorkspace, exportNewsletterSignups);
router.delete(
  '/signups/:id',
  authenticate,
  extractWorkspace,
  deleteNewsletterSignupValidation,
  deleteNewsletterSignup,
);

export default router;
