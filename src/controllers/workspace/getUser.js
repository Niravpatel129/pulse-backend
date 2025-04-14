import Participant from '../../models/Participant.js';
import User from '../../models/User.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * Get user or participant by ID
 * @route GET /api/workspaces/user/:id
 * @access Private (Authenticated users)
 */
export const getUser = async (req, res, next) => {
  try {
    const userId = req.params.id;

    if (!userId) {
      throw new ApiError(400, 'User ID is required');
    }

    // First try to find a user
    let user = await User.findById(userId).select('-password');

    // If no user found, try to find a participant
    if (!user) {
      user = await Participant.findById(userId);
    }

    if (!user) {
      throw new ApiError(404, 'User or participant not found');
    }

    return res
      .status(200)
      .json(new ApiResponse(200, user, 'User or participant retrieved successfully'));
  } catch (error) {
    next(error);
  }
};
