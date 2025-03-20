import Activity from '../../models/Activity.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getRecentActivities = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { limit = 10 } = req.query;
    const workspaceId = req.workspace._id;

    const query = {
      workspace: workspaceId,
      project: projectId,
    };

    // Add project filter if projectId is provided
    if (projectId) {
      query.project = projectId;
    }

    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('user', 'name email')
      .populate('project', 'name');

    return res.status(200).json(new ApiResponse(200, activities));
  } catch (error) {
    next(error);
  }
};
