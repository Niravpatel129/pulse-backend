import fs from 'fs';
import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';
import { firebaseStorage } from '../../utils/firebase.js';

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

    try {
      // Get the current user to check if they have an existing avatar
      const currentUser = await User.findById(req.user.id);

      // If user has an existing avatar in Firebase, delete it
      if (currentUser && currentUser.avatarStoragePath) {
        try {
          await firebaseStorage.deleteFile(currentUser.avatarStoragePath);
        } catch (error) {
          console.error('Failed to delete previous avatar:', error);
          // Continue with upload even if delete fails
        }
      }

      // Read file buffer
      const fileBuffer = fs.readFileSync(req.file.path);

      // Generate storage path for Firebase
      const timestamp = Date.now();
      const storagePath = `avatars/${req.user.id}/${timestamp}_${req.file.originalname.replace(
        /[^a-zA-Z0-9.-]/g,
        '_',
      )}`;

      // Upload to Firebase
      const { url, storagePath: savedPath } = await firebaseStorage.uploadFile(
        fileBuffer,
        storagePath,
        req.file.mimetype,
      );

      // Delete local temp file
      fs.unlinkSync(req.file.path);

      // Update user with Firebase avatar URL and storage path
      const user = await User.findByIdAndUpdate(
        req.user.id,
        {
          avatar: url,
          avatarStoragePath: savedPath,
        },
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
    } catch (uploadError) {
      console.error('Avatar upload error:', uploadError);
      return next(new AppError(`Failed to upload avatar: ${uploadError.message}`, 500));
    }
  } catch (error) {
    // Delete the uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(new AppError(error.message, 500));
  }
};
