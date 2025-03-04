import express from 'express';
import { protect } from '../config/middleware/auth.js';
import validateRequest from '../config/middleware/validateRequest.js';
import { createUser as createUserSchema } from '../config/validators/userValidators.js';
import { getMe, login, register } from '../controllers/auth/index.js';

const router = express.Router();

router.post('/register', validateRequest(createUserSchema), register);
router.post('/login', login);
router.get('/me', protect, getMe);

export default router;
