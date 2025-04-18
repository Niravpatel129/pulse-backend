import express from 'express';
import multer from 'multer';
import validateRequest from '../config/middleware/validateRequest.js';
import {
  saveTemplate as saveTemplateSchema,
  sendEmail as sendEmailSchema,
} from '../config/validators/emailValidators.js';
import { getEmailDetails, getEmailHistory } from '../controllers/email/historyController.js';
import { replyEmail } from '../controllers/email/replyEmailController.js';
import { sendEmail } from '../controllers/email/sendEmailController.js';
import {
  deleteTemplate,
  getTemplates,
  saveTemplate,
} from '../controllers/email/templateController.js';
import toggleReadStatus from '../controllers/email/toggleReadStatus.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Configure multer for handling multipart/form-data
const upload = multer();

// Apply authentication and workspace middleware to all routes
router.use(authenticate);
router.use(extractWorkspace);

// Email sending routes
router.post('/send', upload.array('attachments'), validateRequest(sendEmailSchema), sendEmail);
router.post('/reply', upload.array('attachments'), validateRequest(sendEmailSchema), replyEmail);

// Email history routes
router.get('/history/:projectId', getEmailHistory);
router.patch('/:emailId/toggle-read-status', toggleReadStatus);

router.get('/:emailId', getEmailDetails);

// Template routes
router.get('/templates/:projectId', getTemplates);
router.post('/templates', validateRequest(saveTemplateSchema), saveTemplate);
router.delete('/templates/:templateId', deleteTemplate);

export default router;
