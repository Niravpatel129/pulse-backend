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

router.get('/invoice-settings', authenticate, extractWorkspace, getInvoiceSettings);

router.get('/:id', getInvoice);
router.post('/:id/payment-intent', createPaymentIntent);

router.get('/', authenticate, extractWorkspace, getInvoices);

router.patch('/invoice-settings', authenticate, extractWorkspace, updateInvoiceSettings);

router.post('/', authenticate, extractWorkspace, createInvoice);

router.patch('/:id', authenticate, extractWorkspace, updateInvoice);
router.put('/:id', authenticate, extractWorkspace, updateInvoice);

router.delete('/:id', authenticate, extractWorkspace, deleteInvoice);

router.post('/:id/send', authenticate, extractWorkspace, sendInvoice);

router.patch('/:id/paid', authenticate, extractWorkspace, markAsPaid);

export default router;
