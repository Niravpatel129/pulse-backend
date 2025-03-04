import express from 'express';
import validateRequest from '../config/middleware/validateRequest.js';
import {
  createUser as createUserSchema,
  updateUser as updateUserSchema,
} from '../config/validators/userValidators.js';
import { createUser } from '../controllers/user/createUserController.js';
import { deleteUser } from '../controllers/user/deleteUserController.js';
import { getUser } from '../controllers/user/getUserController.js';
import { getUsers } from '../controllers/user/getUsersController.js';
import { updateUser } from '../controllers/user/updateUserController.js';

const router = express.Router();

router.route('/').get(getUsers).post(validateRequest(createUserSchema), createUser);

router
  .route('/:id')
  .get(getUser)
  .put(validateRequest(updateUserSchema), updateUser)
  .delete(deleteUser);

export default router;
