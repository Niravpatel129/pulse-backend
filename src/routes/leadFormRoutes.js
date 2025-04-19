import express from 'express';
import {
  archiveLeadForm,
  createLeadForm,
  deleteLeadForm,
  getLeadForm,
  getLeadForms,
  publishLeadForm,
  updateLeadForm,
} from '../controllers/leadForm/index.js';
import {
  getFormSubmissions,
  getSubmission,
  submitLeadForm,
} from '../controllers/leadForm/submissionController.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Apply authentication middleware to protected routes
router.use(['/'], authenticate);
router.use(['/'], extractWorkspace);

// Lead Form CRUD routes (protected)
router.post('/', createLeadForm);
router.get('/', getLeadForms);
router.get('/:id', getLeadForm);
router.put('/:id', updateLeadForm);
router.delete('/:id', deleteLeadForm);
router.put('/:id/publish', publishLeadForm);
router.put('/:id/archive', archiveLeadForm);

// Submission routes
router.post('/:id/submit', submitLeadForm); // Public route (no auth required)
router.get('/:id/submissions', authenticate, getFormSubmissions); // Protected
router.get('/:formId/submissions/:submissionId', authenticate, getSubmission); // Protected

export default router;
