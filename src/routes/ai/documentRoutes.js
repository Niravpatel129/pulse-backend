import express from 'express';
import multer from 'multer';
import {
  deleteDocument,
  getDocuments,
  uploadDocument,
} from '../../controllers/ai/documentController.js';
import { authenticate } from '../../middleware/auth.js';
import { extractWorkspace } from '../../middleware/workspace.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if the file type is supported
    const supportedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/markdown',
      'text/csv',
    ];

    if (supportedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error('Unsupported file type. Supported types: PDF, Word, Excel, Text, Markdown, CSV'),
        false,
      );
    }
  },
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'File too large',
        details: 'File size exceeds the maximum limit of 10MB',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid file field',
        details: 'Please use the field name "document" for the file upload',
      });
    }
    return res.status(400).json({
      status: 'error',
      message: 'File upload error',
      details: err.message,
    });
  }
  if (err) {
    return res.status(400).json({
      status: 'error',
      message: 'File upload error',
      details: err.message,
    });
  }
  next();
};

// Upload document route
router.post(
  '/upload',
  authenticate,
  extractWorkspace,
  upload.single('document'),
  handleMulterError,
  uploadDocument,
);

// Delete document route
router.delete('/delete', authenticate, extractWorkspace, deleteDocument);

// Get all documents route
router.get('/', authenticate, extractWorkspace, getDocuments);

export default router;
