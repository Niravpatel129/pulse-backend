import Deliverable from '../../models/Deliverable.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

// Get deliverables by project ID
export const getDeliverablesByProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    const workspaceId = req.workspace._id;

    // Find all deliverables for the specified project
    const deliverables = await Deliverable.find({
      project: projectId,
      workspace: workspaceId,
    }).sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, deliverables));
  } catch (error) {
    next(error);
  }
};
