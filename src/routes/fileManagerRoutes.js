import express from 'express';
import {
  createFolder,
  deleteItem,
  getFiles,
  moveItem,
  renameItem,
  uploadFile,
} from '../controllers/fileManager/index.js';
import { authenticate } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Apply authentication and workspace middleware to all routes
router.use(authenticate);
router.use(extractWorkspace);

// Get files and folders
router.get('/', getFiles);

// Get file structure
router.get('/structure', getFiles);

// Create a new folder
router.post('/folders', createFolder);

// Upload files
router.post('/upload', upload('files'), uploadFile);

// Move a file or folder
router.put('/:itemId/move', moveItem);

// Rename a file or folder
router.put('/:itemId/rename', renameItem);

// Delete a file or folder
router.delete('/:itemId', deleteItem);

export default router;
