const { register } = require('./registerController');
const { login } = require('./loginController');
const { getMe } = require('./getMeController');

module.exports = {
  register,
  login,
  getMe,
};
