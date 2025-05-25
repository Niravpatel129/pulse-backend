import express from 'express';
import { createInvoice } from '../controllers/invoice2/createInvoice.js';
import { deleteInvoice } from '../controllers/invoice2/deleteInvoice.js';
import { downloadInvoice } from '../controllers/invoice2/downloadInvoice.js';
import { getAllInvoices } from '../controllers/invoice2/getAllInvoices.js';
import { getInvoice } from '../controllers/invoice2/getInvoice.js';
import { getLastInvoiceSettings } from '../controllers/invoice2/getLastInvoiceSettings.js';
import { updateInvoice } from '../controllers/invoice2/updateInvoice.js';
import { updateInvoiceStatus } from '../controllers/invoice2/updateInvoiceStatus.js';
import { validateInvoiceNumber } from '../controllers/invoice2/validateInvoiceNumber.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.use(authenticate);
router.use(extractWorkspace);

router.route('/').get(getAllInvoices).post(createInvoice);

router.route('/:id').get(getInvoice).patch(updateInvoice).put(updateInvoice).delete(deleteInvoice);

router.route('/:id/status').patch(updateInvoiceStatus);

router.route('/settings/last').get(getLastInvoiceSettings);

router.route('/validate-number/:invoiceNumber').get(validateInvoiceNumber);

router.route('/:id/download').get(downloadInvoice);

export default router;
