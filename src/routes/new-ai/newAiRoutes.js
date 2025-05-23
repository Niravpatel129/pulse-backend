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

// Set up rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later',
});

// Apply middleware
router.use(limiter);
router.use(authenticate);
router.use(extractWorkspace);

// Streaming chat endpoint
router.post('/chat/stream', streamChat);

// List conversations
router.get('/chat/conversations', listConversations);

// Get conversation history
router.get('/chat/history/:sessionId', getConversationHistory);

// Clear conversation history
router.delete('/chat/history/:sessionId', clearChatHistory);

export default router;
