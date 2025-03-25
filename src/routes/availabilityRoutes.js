import express from 'express';
import getAvailabilitySettings from '../controllers/availability/getAvailabilitySettings.js';
import updateAvailabilitySettings from '../controllers/availability/updateAvailabilitySettings.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/settings', getAvailabilitySettings);
router.put('/settings', updateAvailabilitySettings);

export default router;
