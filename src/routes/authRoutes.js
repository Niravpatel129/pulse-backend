import express from 'express';
import { protect } from '../config/middleware/auth.js';
import validateRequest from '../config/middleware/validateRequest.js';
import { createUser as createUserSchema } from '../config/validators/userValidators.js';
import { getMe } from '../controllers/auth/getMeController.js';
import { login } from '../controllers/auth/loginController.js';
import { logout } from '../controllers/auth/logoutController.js';
import { register } from '../controllers/auth/registerController.js';

const router = express.Router();

router.post('/register', validateRequest(createUserSchema), register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/logout', logout);

export default router;
