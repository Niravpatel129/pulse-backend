import userService from '../../services/userService.js';
import AppError from '../../utils/AppError.js';

// @desc    Get all users
// @route   GET /api/users
// @access  Public
export const getUsers = async (req, res, next) => {
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
