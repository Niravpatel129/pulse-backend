import express from 'express';
import multer from 'multer';
import validateRequest from '../config/middleware/validateRequest.js';
import {
  updatePassword as updatePasswordSchema,
  updateProfile as updateProfileSchema,
} from '../config/validators/profileValidators.js';
import {
  createUser as createUserSchema,
  updateUser as updateUserSchema,
} from '../config/validators/userValidators.js';
import { createUser } from '../controllers/user/createUserController.js';
import { deleteUser } from '../controllers/user/deleteUserController.js';
import { getProfile } from '../controllers/user/getProfileController.js';
import { getUser } from '../controllers/user/getUserController.js';
import { getUsers } from '../controllers/user/getUsersController.js';
import { updatePassword } from '../controllers/user/updatePasswordController.js';
import { updateProfile } from '../controllers/user/updateProfileController.js';
import { updateUser } from '../controllers/user/updateUserController.js';
import { uploadAvatar } from '../controllers/user/uploadAvatarController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Admin routes - manage all users
router.route('/').get(getUsers).post(validateRequest(createUserSchema), createUser);

// Profile routes - for authenticated users to manage their own profile
// These specific routes must come before the parametric /:id route
router
  .route('/profile')
  .get(authenticate, getProfile)
  .put(authenticate, validateRequest(updateProfileSchema), updateProfile);

router.route('/password').put(authenticate, validateRequest(updatePasswordSchema), updatePassword);

router.route('/avatar').post(authenticate, upload.single('avatar'), uploadAvatar);

// This parametric route should come after all specific routes
router
  .route('/:id')
  .get(getUser)
  .put(validateRequest(updateUserSchema), updateUser)
  .delete(deleteUser);

export default router;
