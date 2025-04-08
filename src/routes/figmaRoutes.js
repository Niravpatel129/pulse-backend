import express from 'express';
import { addFigmaFile } from '../controllers/workspace/figma/addFigmaFile.js';
import { deleteFigmaFile } from '../controllers/workspace/figma/deleteFigmaFile.js';
import { getFigmaFiles } from '../controllers/workspace/figma/getFigmaFiles.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.get('/files', getFigmaFiles);
router.post('/files', addFigmaFile);

router.delete('/files/:id', deleteFigmaFile);

export default router;
