import ApiKey from '../../models/ApiKey.js';
import AppError from '../../utils/AppError.js';

/**
 * Lists all API keys for the workspace
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const listApiKeys = async (req, res, next) => {
  try {
    const apiKeys = await ApiKey.find({
      workspaceId: req.workspaceId,
      revokedAt: null,
    }).select('-key'); // Don't return the actual keys

    res.status(200).json({
      status: 'success',
      results: apiKeys.length,
      data: {
        apiKeys,
      },
    });
  } catch (error) {
    next(new AppError('Error fetching API keys', 500));
  }
};
