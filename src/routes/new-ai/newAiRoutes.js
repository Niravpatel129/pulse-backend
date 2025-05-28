import express from 'express';
import multer from 'multer';
import {
  clearChatHistory,
  embedWorkspaceData,
  getConversationHistory,
  listConversations,
  streamChat,
} from '../../controllers/newAi/index.js';
import { authenticate } from '../../middleware/auth.js';
import { extractWorkspace } from '../../middleware/workspace.js';

const router = express.Router();
const upload = multer();

router.use(authenticate);
router.use(extractWorkspace);

router.post('/chat/stream', upload.array('images'), streamChat);

router.get('/chat/conversations', listConversations);

router.get('/chat/history/:sessionId', getConversationHistory);

router.delete('/chat/history/:sessionId', clearChatHistory);

// New route for embedding workspace data
router.post('/embed', upload.none(), embedWorkspaceData);

export default router;
