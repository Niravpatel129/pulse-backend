import express from 'express';
import inboundEmailController from '../controllers/public/inboundEmailController.js';

const router = express.Router();

router.post('/inbound', inboundEmailController);

export default router;
