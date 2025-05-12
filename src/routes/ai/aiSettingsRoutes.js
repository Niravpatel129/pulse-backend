import express from 'express';
import {
  getAISettings,
  resetAISettings,
  updateAISettings,
} from '../../controllers/ai/aiSettingsController.js';
import { authenticate } from '../../middleware/auth.js';
import { extractWorkspace } from '../../middleware/workspace.js';
const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

// Get AI settings for the workspace
router.get('/', getAISettings);

// Update AI settings
router.put('/', updateAISettings);

// Reset AI settings to default
router.post('/reset', resetAISettings);

export default router;
