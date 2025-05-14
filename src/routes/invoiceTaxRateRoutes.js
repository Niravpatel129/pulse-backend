import express from 'express';
import {
  createTaxRate,
  deleteTaxRate,
  getTaxRates,
  updateTaxRate,
} from '../controllers/invoiceTaxRate/index.js';
import { authenticate } from '../middleware/auth.js';
import { extractWorkspace } from '../middleware/workspace.js';

const router = express.Router();

// Apply authentication and workspace middleware to all routes
router.use(authenticate);
router.use(extractWorkspace);

// Get all tax rates
router.get('/', getTaxRates);

// Create a new tax rate
router.post('/', createTaxRate);

// Update a tax rate
router.put('/:id', updateTaxRate);

// Delete a tax rate
router.delete('/:id', deleteTaxRate);

export default router;
