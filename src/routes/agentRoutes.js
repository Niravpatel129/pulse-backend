import express from 'express';
import { createAgent } from '../controllers/agents/createAgent.js';
import { deleteAgent } from '../controllers/agents/deleteAgent.js';
import { getAgent } from '../controllers/agents/getAgent.js';
import { getWorkspaceAgents } from '../controllers/agents/getWorkspaceAgents.js';
import { updateAgent } from '../controllers/agents/updateAgent.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Protect all routes
router.use(authenticate);
router.use(extractWorkspace);

// Routes
router.route('/').get(getWorkspaceAgents).post(createAgent);

router.route('/:id').get(getAgent).put(updateAgent).delete(deleteAgent);

export default router;
