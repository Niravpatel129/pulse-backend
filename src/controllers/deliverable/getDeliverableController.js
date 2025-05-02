import Deliverable from '../../models/Deliverable.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

// Get all deliverables
export const getAllDeliverables = async (req, res, next) => {
  try {
    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    const workspaceId = req.workspace._id;

    // Get project filter if provided
    const { project } = req.query;
    const filter = { workspace: workspaceId };

    if (project) {
      filter.project = project;
    }

    const deliverables = await Deliverable.find(filter).sort({
      createdAt: -1,
    });

    return res.status(200).json(new ApiResponse(200, deliverables));
  } catch (error) {
    next(error);
  }
};

// Get single deliverable
export const getDeliverable = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    const workspaceId = req.workspace._id;

    const deliverable = await Deliverable.findOne({
      _id: id,
      workspace: workspaceId,
    });

    if (!deliverable) {
      throw new ApiError(404, 'Deliverable not found');
    }

    return res.status(200).json(new ApiResponse(200, deliverable));
  } catch (error) {
    next(error);
  }
};
