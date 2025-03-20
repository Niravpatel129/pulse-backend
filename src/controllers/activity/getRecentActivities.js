import Activity from '../../models/Activity.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getRecentActivities = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;
    const workspaceId = req.workspace._id;

    if (!userId) {
      throw new ApiError(400, 'User ID is required');
    }

    const activities = await Activity.find({
      user: userId,
      workspace: workspaceId,
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('user', 'name email');

    return res.status(200).json(new ApiResponse(200, activities));
  } catch (error) {
    next(error);
  }
};
