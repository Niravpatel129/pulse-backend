import userService from '../../services/userService.js';
import AppError from '../../utils/AppError.js';

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Public
export const deleteUser = async (req, res, next) => {
  try {
    const user = await userService.deleteUser(req.params.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};
