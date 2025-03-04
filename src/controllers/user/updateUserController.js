import userService from '../../services/userService.js';
import AppError from '../../utils/AppError.js';

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Public
export const updateUser = async (req, res, next) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body);
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};
