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
import unsubscribeNewsletter from '../controllers/newsletter/unsubscribeNewsletter.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/signup', createNewsletterSignupValidation, createNewsletterSignup);
router.post('/unsubscribe', unsubscribeNewsletterValidation, unsubscribeNewsletter);

// Protected routes (authentication required)
router.get('/signups', getNewsletterSignupsValidation, getNewsletterSignups);
router.get('/stats', getNewsletterStatsValidation, getNewsletterStats);
router.get('/export', exportNewsletterSignups);
router.delete('/signups/:id', deleteNewsletterSignupValidation, deleteNewsletterSignup);

export default router;
