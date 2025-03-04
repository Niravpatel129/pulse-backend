import express from 'express';
import validateRequest from '../config/middleware/validateRequest.js';
import {
  createUser as createUserSchema,
  updateUser as updateUserSchema,
} from '../config/validators/userValidators.js';
import {
  createUser,
  deleteUser,
  getUser,
  getUsers,
  updateUser,
} from '../controllers/user/index.js';

const router = express.Router();

router.route('/').get(getUsers).post(validateRequest(createUserSchema), createUser);

router
  .route('/:id')
  .get(getUser)
  .put(validateRequest(updateUserSchema), updateUser)
  .delete(deleteUser);

export default router;
