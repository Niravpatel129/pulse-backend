import express from 'express';
import createFileElement from '../controllers/elements/createFileElement.js';
import { authenticate } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Apply workspace access check to all routes
router.use(extractWorkspace);

// Element routes
router.post('/modules/file-element/:moduleId', upload('files'), createFileElement);

export default router;
