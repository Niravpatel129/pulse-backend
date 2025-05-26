import express from 'express';
import {
  clearChatHistory,
  getConversationHistory,
  listConversations,
  streamChat,
} from '../../controllers/newAi/index.js';
import { authenticate } from '../../middleware/auth.js';
import { extractWorkspace } from '../../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.post('/chat/stream', streamChat);

router.get('/chat/conversations', listConversations);

router.get('/chat/history/:sessionId', getConversationHistory);

router.delete('/chat/history/:sessionId', clearChatHistory);

export default router;
