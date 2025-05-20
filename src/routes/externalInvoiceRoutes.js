import express from 'express';
import { createInvoice } from '../controllers/invoice/createInvoice.js';
import { getInvoice } from '../controllers/invoice/getInvoice.js';
import { updateInvoice } from '../controllers/invoice/updateInvoice.js';
import { authenticateApiKey } from '../middleware/apiKeyAuth.js';

const router = express.Router();

// Create invoice with API key
router.post('/', authenticateApiKey(['invoice:create']), createInvoice);

// Get invoice by ID with API key
router.get('/:id', authenticateApiKey(['invoice:read']), getInvoice);

// Update invoice with API key
router.put('/:id', authenticateApiKey(['invoice:update']), updateInvoice);

export default router;
