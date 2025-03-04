const userService = require('../../services/userService');
const AppError = require('../../utils/AppError');

// @desc    Create a user
// @route   POST /api/users
// @access  Public
exports.createUser = async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json({
      status: 'success',
      data: user,
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};
