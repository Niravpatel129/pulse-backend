import express from 'express';
import {
  getChatSettings,
  resetChatSettings,
  updateChatSettings,
} from '../controllers/chatSettingsController.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Protect all routes
router.use(authenticate);
router.use(extractWorkspace);

// Routes
router.route('/').get(getChatSettings).put(updateChatSettings).delete(resetChatSettings);

export default router;
