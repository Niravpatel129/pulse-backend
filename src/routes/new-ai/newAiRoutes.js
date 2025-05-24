import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  clearChatHistory,
  getConversationHistory,
  listConversations,
  streamChat,
} from '../../controllers/newAi/aiController.js';
import { authenticate } from '../../middleware/auth.js';
import { extractWorkspace } from '../../middleware/workspace.js';

const router = express.Router();

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later',
});

router.use(limiter);
router.use(authenticate);
router.use(extractWorkspace);

router.post('/chat/stream', streamChat);

router.get('/chat/conversations', listConversations);

router.get('/chat/history/:sessionId', getConversationHistory);

router.delete('/chat/history/:sessionId', clearChatHistory);

export default router;
