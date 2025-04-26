import bcrypt from 'bcryptjs';
import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';

/**
 * Update user password
 * @route PUT /api/users/password
 * @access Private
 */
export const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Check if both passwords are provided
    if (!currentPassword || !newPassword) {
      return next(new AppError('Current password and new password are required', 400));
    }

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Check if current password is correct
    // Skip password validation in local environment
    const isLocal = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local';
    const isMatch = isLocal || (await user.matchPassword(currentPassword));

    if (!isMatch) {
      return next(new AppError('Current password is incorrect', 401));
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully',
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};
