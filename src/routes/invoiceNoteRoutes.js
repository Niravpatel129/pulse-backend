import express from 'express';
import {
  createInvoiceNote,
  deleteInvoiceNote,
  getInvoiceNotes,
  updateInvoiceNote,
} from '../controllers/invoiceNoteController.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router({ mergeParams: true });

// All routes are protected
router.use(authenticate);
router.use(extractWorkspace);

// Get all notes for an invoice
router.get('/', getInvoiceNotes);

// Create a new note
router.post('/', createInvoiceNote);

// Update a note
router.put('/:noteId', updateInvoiceNote);

// Delete a note
router.delete('/:noteId', deleteInvoiceNote);

export default router;
