const { getUsers } = require('./getUsersController');
const { createUser } = require('./createUserController');
const { getUser } = require('./getUserController');
const { updateUser } = require('./updateUserController');
const { deleteUser } = require('./deleteUserController');

module.exports = {
  getUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
};
