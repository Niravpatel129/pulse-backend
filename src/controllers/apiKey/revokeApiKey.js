import ApiKey from '../../models/ApiKey.js';
import AppError from '../../utils/AppError.js';

/**
 * Revokes an API key
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const revokeApiKey = async (req, res, next) => {
  try {
    const { id } = req.params;

    const apiKey = await ApiKey.findOne({
      _id: id,
      workspaceId: req.workspaceId,
    });

    if (!apiKey) {
      return next(new AppError('API key not found', 404));
    }

    // Set revoked timestamp
    apiKey.revokedAt = new Date();
    await apiKey.save();

    res.status(200).json({
      status: 'success',
      message: 'API key revoked successfully',
    });
  } catch (error) {
    next(new AppError('Error revoking API key', 500));
  }
};
