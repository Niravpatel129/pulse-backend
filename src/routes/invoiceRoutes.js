import express from 'express';

import { createInvoice } from '../controllers/invoice/createInvoice.js';
import { createPaymentIntent } from '../controllers/invoice/createPaymentIntent.js';
import { deleteInvoice } from '../controllers/invoice/deleteInvoice.js';
import { deleteInvoiceAttachment } from '../controllers/invoice/deleteInvoiceAttachment.js';
import { deletePayment } from '../controllers/invoice/deletePayment.js';
import { downloadPayment } from '../controllers/invoice/downloadPayment.js';
import { getInvoice } from '../controllers/invoice/getInvoice.js';
import { getInvoiceActivities } from '../controllers/invoice/getInvoiceActivities.js';
import { getInvoicePayments } from '../controllers/invoice/getInvoicePayments.js';
import { getInvoices } from '../controllers/invoice/getInvoices.js';
import { getInvoiceSettings } from '../controllers/invoice/getInvoiceSettings.js';
import { getPublicInvoice } from '../controllers/invoice/getPublicInvoice.js';
import { markAsPaid } from '../controllers/invoice/markAsPaid.js';
import { recordPayment } from '../controllers/invoice/recordPayment.js';
import { sendInvoice } from '../controllers/invoice/sendInvoice.js';
import { toggleArchive } from '../controllers/invoice/toggleArchive.js';
import { toggleStar } from '../controllers/invoice/toggleStar.js';
import { updateInvoice } from '../controllers/invoice/updateInvoice.js';
import { updateInvoiceAttachments } from '../controllers/invoice/updateInvoiceAttachments.js';
import { updateInvoiceSettings } from '../controllers/invoice/updateInvoiceSettings.js';
import { updatePayment } from '../controllers/invoice/updatePayment.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace, extractWorkspaceWithoutAuth } from '../middleware/workspace.js';
import invoiceNoteRoutes from './invoiceNoteRoutes.js';

const router = express.Router();

router.get('/invoice-settings', extractWorkspaceWithoutAuth, getInvoiceSettings);

router.get('/activities', authenticate, extractWorkspace, getInvoiceActivities);

router.get('/:id/public', getPublicInvoice);

router.get('/:id', authenticate, extractWorkspace, getInvoice);

router.get('/:id/payments', authenticate, extractWorkspace, getInvoicePayments);

router.post('/:id/payment-intent', createPaymentIntent);

router.get('/', authenticate, extractWorkspace, getInvoices);

router.patch('/invoice-settings', authenticate, extractWorkspace, updateInvoiceSettings);

router.post('/', authenticate, extractWorkspace, createInvoice);

router.patch('/:id', authenticate, extractWorkspace, updateInvoice);
router.put('/:id', authenticate, extractWorkspace, updateInvoice);

router.delete('/:id', authenticate, extractWorkspace, deleteInvoice);

router.post('/:id/send', authenticate, extractWorkspace, sendInvoice);

router.patch('/:id/paid', authenticate, extractWorkspace, markAsPaid);

router.post('/:id/payments', authenticate, extractWorkspace, recordPayment);

router.delete('/:id/payments/:paymentId', authenticate, extractWorkspace, deletePayment);

router.get('/:id/payments/:paymentId/download', extractWorkspaceWithoutAuth, downloadPayment);

router.put('/:id/payments/:paymentId', authenticate, extractWorkspace, updatePayment);

router.put('/:id/star', authenticate, extractWorkspace, toggleStar);
router.put('/:id/archive', authenticate, extractWorkspace, toggleArchive);

// Attachments routes
router.post('/:id/attachments', authenticate, extractWorkspace, updateInvoiceAttachments);
router.delete(
  '/:id/attachments/:attachmentId',
  authenticate,
  extractWorkspace,
  deleteInvoiceAttachment,
);

// Invoice notes routes
router.use('/:id/notes', invoiceNoteRoutes);

export default router;
