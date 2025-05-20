import ApiKey from '../models/ApiKey.js';
import AppError from '../utils/AppError.js';

/**
 * Middleware to authenticate requests using API key
 * @param {Array} requiredPermissions - Array of permissions required for this endpoint
 * @returns {Function} Express middleware
 */
export const authenticateApiKey = (requiredPermissions = []) => {
  return async (req, res, next) => {
    try {
      // Get API key from header
      const apiKey = req.headers['x-api-key'];

      if (!apiKey) {
        return next(new AppError('API key is required', 401));
      }

      // Find API key in database
      const apiKeyDoc = await ApiKey.findOne({ key: apiKey, revokedAt: null });

      if (!apiKeyDoc) {
        return next(new AppError('Invalid API key', 401));
      }

      // Check if API key has required permissions
      if (requiredPermissions.length > 0) {
        const hasAllPermissions = requiredPermissions.every((permission) =>
          apiKeyDoc.permissions.includes(permission),
        );

        if (!hasAllPermissions) {
          return next(new AppError('Insufficient permissions', 403));
        }
      }

      // Update last used timestamp
      await ApiKey.findByIdAndUpdate(apiKeyDoc._id, {
        lastUsed: new Date(),
      });

      // Add workspace ID to request
      req.workspaceId = apiKeyDoc.workspaceId;
      req.apiKey = apiKeyDoc;

      next();
    } catch (error) {
      next(new AppError('API key authentication failed', 401));
    }
  };
};
