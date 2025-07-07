import express from 'express';
import { addAttachment } from '../controllers/invoice2/addAttachment.js';
import { createInvoice } from '../controllers/invoice2/createInvoice.js';
import { createPaymentIntent } from '../controllers/invoice2/createPaymentIntent.js';
import { deleteAttachment } from '../controllers/invoice2/deleteAttachment.js';
import { deleteInvoice } from '../controllers/invoice2/deleteInvoice.js';
import { downloadInvoice } from '../controllers/invoice2/downloadInvoice.js';
import { getAllInvoices } from '../controllers/invoice2/getAllInvoices.js';
import { getInvoice } from '../controllers/invoice2/getInvoice.js';
import { getInvoiceSummary } from '../controllers/invoice2/getInvoiceSummary.js';
import { getLastInvoiceSettings } from '../controllers/invoice2/getLastInvoiceSettings.js';
import { handlePaymentSuccess } from '../controllers/invoice2/handlePaymentSuccess.js';
import { markInvoiceAsPaid } from '../controllers/invoice2/markInvoiceAsPaid.js';
import { sendInvoice } from '../controllers/invoice2/sendInvoice.js';
import { handleStripeWebhook } from '../controllers/invoice2/stripeWebhookHandler.js';
import { updateInternalNote } from '../controllers/invoice2/updateInternalNote.js';
import { updateInvoice } from '../controllers/invoice2/updateInvoice.js';
import { updateInvoiceStatus } from '../controllers/invoice2/updateInvoiceStatus.js';
import {
  addPaymentAttempt,
  cancelPaymentIntent,
  getPaymentIntent,
  getPaymentIntentsForInvoice,
  updatePaymentIntentStatus,
} from '../controllers/invoice2/updatePaymentIntentStatus.js';
import { validateInvoiceNumber } from '../controllers/invoice2/validateInvoiceNumber.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace, extractWorkspaceWithoutAuth } from '../middleware/workspace.js';

const router = express.Router();

router.route('/summary').get(extractWorkspaceWithoutAuth, getInvoiceSummary);

// Public routes (no auth required)
router.route('/:id').get(getInvoice);
router.route('/:id/payment-intent').post(extractWorkspaceWithoutAuth, createPaymentIntent);
router.route('/:id/payment-success').post(extractWorkspaceWithoutAuth, handlePaymentSuccess);

// Webhook route (no auth required)
router.route('/webhook/stripe').post(handleStripeWebhook);

// Apply auth and workspace middleware
router.use(authenticate);
router.use(extractWorkspace);

// Specific routes (must come before parameterized routes)
router.route('/settings/last').get(getLastInvoiceSettings);
router.route('/validate-number/:invoiceNumber').get(validateInvoiceNumber);

// Base routes
router.route('/').get(getAllInvoices).post(createInvoice);

// Parameterized routes
router.route('/:id').patch(updateInvoice).put(updateInvoice).delete(deleteInvoice);
router.route('/:id/status').patch(updateInvoiceStatus).put(updateInvoiceStatus);
router.route('/:id/paid').post(markInvoiceAsPaid);
router.route('/:id/download').get(downloadInvoice);
router.route('/:id/internal-note').patch(updateInternalNote);
router.route('/:id/attachments').post(addAttachment);
router.route('/:id/attachments/:fileId').delete(deleteAttachment);
router.route('/:id/send').post(sendInvoice);

// Payment Intent routes
router.get('/:invoiceId/payment-intents', getPaymentIntentsForInvoice);
router.get('/payment-intent/:id', getPaymentIntent);
router.post('/payment-intent/:id/status', updatePaymentIntentStatus);
router.post('/payment-intent/:id/cancel', cancelPaymentIntent);
router.post('/payment-intent/:id/attempt', addPaymentAttempt);

export default router;
