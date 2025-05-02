import express from 'express';
import multer from 'multer';
import {
  createDeliverable,
  deleteDeliverable,
  getAllDeliverables,
  getDeliverable,
  getDeliverablesByProject,
  updateDeliverable,
} from '../controllers/deliverable/deliverableController.js';
import { resolveInactivityAlerts } from '../middleware/alertsMiddleware.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Custom multer middleware to handle file uploads with any field name
const uploadAnyField = (req, res, next) => {
  console.log('Processing file upload with multer...');

  upload.any()(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Better error messages for Multer errors
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          status: 'error',
          message: 'File too large. Maximum size is 10MB.',
          error: err.code,
        });
      }
      return res.status(400).json({
        success: false,
        status: 'error',
        message: err.message,
        error: err.code,
      });
    } else if (err) {
      console.error('File upload error:', err);
      return res.status(500).json({
        success: false,
        status: 'error',
        message: 'File upload failed',
        error: err.message,
      });
    }

    // Log information about uploaded files
    if (req.files && req.files.length > 0) {
      console.log(
        `Processed ${req.files.length} files:`,
        req.files.map((f) => ({
          fieldname: f.fieldname,
          originalname: f.originalname,
          size: f.size,
          mimetype: f.mimetype,
        })),
      );
    } else {
      console.log('No files were uploaded');
    }

    next();
  });
};

// Middleware to parse JSON with possible file attachments
const parseRequestData = (req, res, next) => {
  try {
    console.log('Parsing request data...');

    // If request has files, the body might be stringified JSON
    if (req.body.data && typeof req.body.data === 'string') {
      console.log('Found stringified JSON data, parsing...');
      req.body = JSON.parse(req.body.data);
    }

    // Process files if they exist
    if (req.files && req.files.length > 0) {
      console.log(`Processing ${req.files.length} files in request...`);

      // Convert files to base64 for processing
      const processedFiles = req.files.map((file) => {
        console.log(`Processing file: ${file.fieldname}, ${file.originalname}, ${file.size} bytes`);

        return {
          fieldname: file.fieldname,
          originalname: file.originalname,
          encoding: file.encoding,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer,
          data: file.buffer.toString('base64'),
        };
      });

      // Add files to request body
      req.body.files = processedFiles;
      console.log('Files added to request body');
    }
    next();
  } catch (error) {
    console.error('Error parsing request data:', error);
    return res.status(400).json({
      success: false,
      status: 'error',
      message: 'Invalid request data format',
      error: error.message,
    });
  }
};

// All routes require authentication and workspace context
router.use(authenticate);
router.use(extractWorkspace);
router.use(resolveInactivityAlerts);

// Get all deliverables
router.get('/', getAllDeliverables);

// Get deliverables by project
router.get('/project/:projectId', getDeliverablesByProject);

// Get single deliverable
router.get('/:id', getDeliverable);

// Create deliverable - with file upload support
router.post('/', uploadAnyField, parseRequestData, createDeliverable);

// Update deliverable - with file upload support
router.put('/:id', uploadAnyField, parseRequestData, updateDeliverable);

// Delete deliverable
router.delete('/:id', deleteDeliverable);

export default router;
