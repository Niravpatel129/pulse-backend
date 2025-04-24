import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';

/**
 * Get logged in user's profile
 * @route GET /api/users/profile
 * @access Private
 */
export const getProfile = async (req, res, next) => {
  try {
    // req.user is set by the authenticate middleware
    const user = await User.findById(req.user.id).select('-password');

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
