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
import { updateInternalNote } from '../controllers/invoice2/updateInternalNote.js';
import { updateInvoice } from '../controllers/invoice2/updateInvoice.js';
import { updateInvoiceStatus } from '../controllers/invoice2/updateInvoiceStatus.js';
import { validateInvoiceNumber } from '../controllers/invoice2/validateInvoiceNumber.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.route('/').get(getAllInvoices).post(createInvoice);

router.route('/summary').get(getInvoiceSummary);

router.route('/:id').get(getInvoice).patch(updateInvoice).put(updateInvoice).delete(deleteInvoice);

router.route('/:id/status').patch(updateInvoiceStatus).put(updateInvoiceStatus);

router.route('/:id/paid').post(markInvoiceAsPaid);

router.route('/settings/last').get(getLastInvoiceSettings);

router.route('/validate-number/:invoiceNumber').get(validateInvoiceNumber);

router.route('/:id/download').get(downloadInvoice);

router.route('/:id/internal-note').patch(updateInternalNote);

router.route('/:id/attachments').post(addAttachment);

router.route('/:id/attachments/:fileId').delete(deleteAttachment);

router.route('/:id/payment-intent').post(createPaymentIntent);

router.route('/:id/payment-success').post(handlePaymentSuccess);

export default router;
