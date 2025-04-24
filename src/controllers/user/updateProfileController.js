import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';

/**
 * Update user profile
 * @route PUT /api/users/profile
 * @access Private
 */
export const updateProfile = async (req, res, next) => {
  try {
    // Fields that users can update
    const { name, email, phone, jobTitle, bio } = req.body;

    // Build update object with only the fields that were provided
    const updateFields = {};
    if (name) updateFields.name = name;
    if (email) updateFields.email = email;
    if (phone) updateFields.phone = phone;
    if (jobTitle) updateFields.jobTitle = jobTitle;
    if (bio) updateFields.bio = bio;

    // Find and update the user profile
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: true },
    ).select('-password');

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
