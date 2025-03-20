import Activity from '../../models/Activity.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const createActivity = async (req, res, next) => {
  try {
    const { type, action, description, entityId, entityType, metadata = {} } = req.body;

    const userId = req.user._id;
    const workspaceId = req.workspace._id;

    // Validate required fields
    if (!type || !action || !description || !entityId || !entityType) {
      throw new ApiError(400, 'Missing required fields');
    }

    const activity = await Activity.create({
      user: userId,
      workspace: workspaceId,
      type,
      action,
      description,
      entityId,
      entityType,
      metadata,
    });

    // Populate user information
    await activity.populate('user', 'name email');

    return res.status(201).json(new ApiResponse(201, activity));
  } catch (error) {
    next(error);
  }
};
