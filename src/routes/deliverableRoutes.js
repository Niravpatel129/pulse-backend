import express from 'express';
import multer from 'multer';
import {
  createDeliverable,
  deleteDeliverable,
  getAllDeliverables,
  getDeliverable,
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

// Middleware to parse JSON with possible file attachments
const parseRequestData = (req, res, next) => {
  try {
    // If request has files, the body might be stringified JSON
    if (req.body.data && typeof req.body.data === 'string') {
      req.body = JSON.parse(req.body.data);
    }

    // Process files if they exist
    if (req.files && req.files.length > 0) {
      // Convert files to base64 for processing
      const processedFiles = req.files.map((file) => ({
        fieldname: file.fieldname,
        originalname: file.originalname,
        encoding: file.encoding,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
        data: file.buffer.toString('base64'),
      }));

      // Add files to request body
      req.body.files = processedFiles;
    }
    next();
  } catch (error) {
    next(error);
  }
};

// All routes require authentication and workspace context
router.use(authenticate);
router.use(extractWorkspace);
router.use(resolveInactivityAlerts);

// Get all deliverables
router.get('/', getAllDeliverables);

// Get single deliverable
router.get('/:id', getDeliverable);

// Create deliverable - with file upload support
router.post('/', upload.array('files'), parseRequestData, createDeliverable);

// Update deliverable - with file upload support
router.put('/:id', upload.array('files'), parseRequestData, updateDeliverable);

// Delete deliverable
router.delete('/:id', deleteDeliverable);

export default router;
