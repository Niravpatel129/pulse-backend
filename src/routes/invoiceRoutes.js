import express from 'express';

import { createInvoice } from '../controllers/invoice/createInvoice.js';
import { createPaymentIntent } from '../controllers/invoice/createPaymentIntent.js';
import { deleteInvoice } from '../controllers/invoice/deleteInvoice.js';
import { getInvoice } from '../controllers/invoice/getInvoice.js';
import { getInvoices } from '../controllers/invoice/getInvoices.js';
import { getInvoiceSettings } from '../controllers/invoice/getInvoiceSettings.js';
import { markAsPaid } from '../controllers/invoice/markAsPaid.js';
import { sendInvoice } from '../controllers/invoice/sendInvoice.js';
import { updateInvoice } from '../controllers/invoice/updateInvoice.js';
import { updateInvoiceSettings } from '../controllers/invoice/updateInvoiceSettings.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

router.get('/:id', getInvoice);
router.post('/:id/payment-intent', createPaymentIntent);

router.use(authenticate);
router.use(extractWorkspace);

router.get('/', getInvoices);

router.get('/invoice-settings', getInvoiceSettings);
router.patch('/invoice-settings', updateInvoiceSettings);

router.post('/', createInvoice);

router.patch('/:id', updateInvoice);

router.delete('/:id', deleteInvoice);

router.post('/:id/send', sendInvoice);

router.patch('/:id/paid', markAsPaid);

export default router;
