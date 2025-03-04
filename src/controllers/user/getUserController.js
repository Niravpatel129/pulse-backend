const userService = require('../../services/userService');
const AppError = require('../../utils/AppError');

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Public
exports.getUser = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};
