import fs from 'fs';
import path from 'path';
import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';

/**
 * Upload user avatar
 * @route POST /api/users/avatar
 * @access Private
 */
export const uploadAvatar = async (req, res, next) => {
  try {
    // Check if file exists
    if (!req.file) {
      return next(new AppError('Please upload a file', 400));
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      // Delete the uploaded file
      fs.unlinkSync(req.file.path);
      return next(new AppError('Please upload an image file (jpg or png)', 400));
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      // Delete the uploaded file
      fs.unlinkSync(req.file.path);
      return next(new AppError('File size should be less than 5MB', 400));
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Rename and move file
    const filename = `user-${req.user.id}-${Date.now()}${path.extname(req.file.originalname)}`;
    const targetPath = path.join(uploadsDir, filename);

    fs.renameSync(req.file.path, targetPath);

    // Get user and update avatar field
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: `/uploads/avatars/${filename}` },
      { new: true },
    ).select('-password');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        user,
      },
    });
  } catch (error) {
    // Delete the uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(new AppError(error.message, 500));
  }
};
