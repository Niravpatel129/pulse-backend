import express from 'express';
import rateLimit from 'express-rate-limit';
import inboundEmailController, {
  handleFileUploads,
} from '../controllers/public/inboundEmailController.js';

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

router.post('/inbound', limiter, handleFileUploads, inboundEmailController);

export default router;
