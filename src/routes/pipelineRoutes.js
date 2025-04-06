import express from 'express';
import { getPipelineSettings } from '../controllers/pipeline/getPipelineSettings.js';
import { updatePipelineStages } from '../controllers/pipeline/updatePipelineStages.js';
import { updatePipelineStatuses } from '../controllers/pipeline/updatePipelineStatuses.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

// Get pipeline settings
router.get('/settings', getPipelineSettings);

// Update stages
router.put('/settings/stages', updatePipelineStages);

// Update statuses
router.put('/settings/statuses', updatePipelineStatuses);

export default router;
