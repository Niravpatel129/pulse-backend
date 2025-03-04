const express = require('express');
const router = express.Router();
const { getUsers, createUser, getUser, updateUser, deleteUser } = require('../controllers/user');
const validateRequest = require('../config/middleware/validateRequest');
const {
  createUser: createUserSchema,
  updateUser: updateUserSchema,
} = require('../config/validators/userValidators');

router.route('/').get(getUsers).post(validateRequest(createUserSchema), createUser);

router
  .route('/:id')
  .get(getUser)
  .put(validateRequest(updateUserSchema), updateUser)
  .delete(deleteUser);

module.exports = router;
