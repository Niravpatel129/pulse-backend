const authService = require('../../services/authService');
const AppError = require('../../utils/AppError');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    if (error.code === 11000) {
      // Handle duplicate key error
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      const message = `Duplicate field value: ${field}. Please use another value!`;
      next(new AppError(message, 400));
    } else {
      next(new AppError(error.message, 400));
    }
  }
};
