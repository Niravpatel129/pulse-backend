import express from 'express';
import { enhanceText } from '../controllers/ai/textController.js';

const router = express.Router();

router.post('/enhance-text', enhanceText);

export default router;
