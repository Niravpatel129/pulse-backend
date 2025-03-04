import userService from '../../services/userService.js';
import AppError from '../../utils/AppError.js';

// @desc    Create a user
// @route   POST /api/users
// @access  Public
export const createUser = async (req, res, next) => {
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
