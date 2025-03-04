const userService = require('../../services/userService');
const AppError = require('../../utils/AppError');

// @desc    Get all users
// @route   GET /api/users
// @access  Public
exports.getUsers = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json({
      status: 'success',
      data: users,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};
