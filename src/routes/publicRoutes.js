import express from 'express';
import inboundEmailController, {
  handleFileUploads,
} from '../controllers/public/inboundEmailController.js';

const router = express.Router();

router.post('/inbound', handleFileUploads, inboundEmailController);

export default router;
