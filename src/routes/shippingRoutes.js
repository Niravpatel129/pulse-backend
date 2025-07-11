import express from 'express';
import { getShippingRates } from '../controllers/shipping/getShippingRates.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = express.Router();

router.post('/rates', asyncHandler(getShippingRates));

export default router;
