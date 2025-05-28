import express from 'express';
import multer from 'multer';
import {
  clearChatHistory,
  deleteWorkspaceEmbeddings,
  embedWorkspaceData,
  getConversationHistory,
  getWorkspaceEmbeddings,
  listConversations,
  streamChat,
} from '../../controllers/newAi/index.js';
import { authenticate } from '../../middleware/auth.js';
import { extractWorkspace } from '../../middleware/workspace.js';

const router = express.Router();
const upload = multer({
  limits: {
    fieldSize: 50 * 1024 * 1024, // 50MB for fields
    fileSize: 50 * 1024 * 1024, // 50MB for files
  },
});

router.use(authenticate);
router.use(extractWorkspace);

router.post('/chat/stream', upload.array('images'), streamChat);

router.get('/chat/conversations', listConversations);

router.get('/chat/history/:sessionId', getConversationHistory);

router.delete('/chat/history/:sessionId', clearChatHistory);

router.post('/embed', upload.none(), embedWorkspaceData);

router.get('/embeddings', getWorkspaceEmbeddings);

router.delete('/embeddings/:id', deleteWorkspaceEmbeddings);

export default router;
