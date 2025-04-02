import express from 'express';
import { deleteFile } from '../controllers/file/deleteFileController.js';
import { getFiles } from '../controllers/file/getFilesController.js';
import { uploadFile } from '../controllers/file/uploadFileController.js';
import { authenticate } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Apply authentication and workspace middleware to all routes
router.use(authenticate);
router.use(extractWorkspace);

// Get files route
router.get('/', getFiles);

// Upload file route
router.post('/upload', upload('files'), uploadFile);

// Delete file route
router.delete('/:fileId', deleteFile);

export default router;
