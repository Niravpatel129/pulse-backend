import ApiKey from '../../models/ApiKey.js';
import AppError from '../../utils/AppError.js';

/**
 * Creates a new API key for external integrations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createApiKey = async (req, res, next) => {
  try {
    const { name, description, permissions } = req.body;

    if (!name) {
      return next(new AppError('API key name is required', 400));
    }

    // Create new API key
    const apiKey = new ApiKey({
      name,
      description,
      workspaceId: req.workspaceId,
      createdBy: req.user._id,
      permissions: permissions || ['invoice:read', 'invoice:create'],
    });

    await apiKey.save();

    res.status(201).json({
      status: 'success',
      data: {
        apiKey: {
          id: apiKey._id,
          key: apiKey.key, // Return the key once - it won't be retrievable again
          name: apiKey.name,
          description: apiKey.description,
          permissions: apiKey.permissions,
          createdAt: apiKey.createdAt,
        },
      },
    });
  } catch (error) {
    next(new AppError('Error creating API key', 500));
  }
};
