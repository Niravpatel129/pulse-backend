import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import Workspace from '../../models/Workspace.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';
import { firebaseStorage } from '../../utils/firebase.js';

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP and SVG are allowed.'));
    }
  },
}).single('logo');

// Middleware wrapper for multer upload
const handleFileUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return next(new ApiError(400, `File upload error: ${err.message}`));
    } else if (err) {
      return next(new ApiError(400, err.message));
    }
    next();
  });
};

export const updateWorkspace = async (req, res, next) => {
  try {
    const { name, description, settings, removeLogo, subdomain } = req.body;

    // Use the workspace that was already extracted by the middleware
    const workspace = req.workspace;

    if (!workspace) {
      throw new ApiError(404, 'Workspace not found or insufficient permissions');
    }

    // Get the workspace ObjectId
    const workspaceId = workspace._id;

    // Prepare update object
    const updateObj = {
      $set: {
        ...(name && { name }),
        ...(subdomain && { subdomain }),
        ...(description && { description }),
        ...(settings?.allowMemberInvites !== undefined && {
          'settings.allowMemberInvites': settings.allowMemberInvites,
        }),
        ...(settings?.defaultProjectVisibility && {
          'settings.defaultProjectVisibility': settings.defaultProjectVisibility,
        }),
      },
    };

    let logoUpdateResult = null;

    // Handle logo upload if a file was provided
    if (req.file) {
      console.log('Processing logo upload', {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });

      try {
        // Generate a path for the logo file
        const logoPath = firebaseStorage.generatePath(
          workspaceId.toString(),
          `logo${path.extname(req.file.originalname)}`,
        );

        // Upload the logo to Firebase Storage
        const { url: logoUrl, storagePath } = await firebaseStorage.uploadFile(
          req.file.buffer,
          logoPath,
          req.file.mimetype,
        );

        // Generate favicon from the uploaded logo
        const faviconBuffer = await sharp(req.file.buffer)
          .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .toBuffer();

        // Generate a path for the favicon file
        const faviconPath = firebaseStorage.generatePath(
          workspaceId.toString(),
          `favicon${path.extname(req.file.originalname)}`,
        );

        // Upload the favicon to Firebase Storage
        const { url: faviconUrl, storagePath: faviconStoragePath } =
          await firebaseStorage.uploadFile(faviconBuffer, faviconPath, req.file.mimetype);

        // Delete old logo and favicon if they exist
        if (workspace.logo && workspace.logo.startsWith('https://')) {
          try {
            // If we have a previous storage path, use it
            if (workspace.logoStoragePath) {
              await firebaseStorage.deleteFile(workspace.logoStoragePath);
              console.log('Deleted old workspace logo:', workspace.logoStoragePath);
            }
            if (workspace.faviconStoragePath) {
              await firebaseStorage.deleteFile(workspace.faviconStoragePath);
              console.log('Deleted old workspace favicon:', workspace.faviconStoragePath);
            }
          } catch (err) {
            console.error('Failed to delete old files, continuing anyway:', err);
          }
        }

        // Update with new logo and favicon information
        updateObj.$set.logo = logoUrl;
        updateObj.$set.favicon = faviconUrl;
        // Store the storage paths in separate fields for future reference
        updateObj.$set.logoStoragePath = storagePath;
        updateObj.$set.faviconStoragePath = faviconStoragePath;
        console.log('Setting new logo and favicon:', { logo: logoUrl, favicon: faviconUrl });

        logoUpdateResult = {
          success: true,
          action: 'upload',
          url: logoUrl,
          faviconUrl,
        };
      } catch (error) {
        console.error('Error uploading logo:', error);
        logoUpdateResult = {
          success: false,
          action: 'upload',
          error: error.message || 'Failed to upload logo',
        };
        // Continue with other updates even if logo upload fails
      }
    }

    // Handle logo removal if requested
    else if (removeLogo === 'true' && workspace.logo) {
      console.log('Removing workspace logo and favicon');

      try {
        // Only try to delete from storage if we have storage paths
        if (workspace.logoStoragePath) {
          await firebaseStorage.deleteFile(workspace.logoStoragePath);
          console.log('Deleted workspace logo:', workspace.logoStoragePath);
        }
        if (workspace.faviconStoragePath) {
          await firebaseStorage.deleteFile(workspace.faviconStoragePath);
          console.log('Deleted workspace favicon:', workspace.faviconStoragePath);
        }

        // Set logo and favicon to empty strings per model definition
        updateObj.$set.logo = '';
        updateObj.$set.favicon = '';

        // Remove the storage paths if they exist
        if (workspace.logoStoragePath || workspace.faviconStoragePath) {
          updateObj.$unset = {
            logoStoragePath: '',
            faviconStoragePath: '',
          };
        }

        logoUpdateResult = {
          success: true,
          action: 'remove',
        };
      } catch (err) {
        console.error('Failed to delete files from storage:', err);
        logoUpdateResult = {
          success: false,
          action: 'remove',
          error: err.message || 'Failed to remove logo and favicon',
        };

        // Still set logo and favicon to empty strings even if deletion fails
        updateObj.$set.logo = '';
        updateObj.$set.favicon = '';
        if (workspace.logoStoragePath || workspace.faviconStoragePath) {
          updateObj.$unset = {
            logoStoragePath: '',
            faviconStoragePath: '',
          };
        }
      }
    }

    const updatedWorkspace = await Workspace.findByIdAndUpdate(workspaceId, updateObj, {
      new: true,
    }).populate('members.user', 'name email');

    // Return just the updated workspace
    return res.status(200).json(new ApiResponse(200, updatedWorkspace));
  } catch (error) {
    console.error('Error updating workspace:', error);
    next(error);
  }
};

// Export middleware for handling file uploads
export const handleWorkspaceFileUpload = handleFileUpload;
