import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getCollaborators = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      throw new ApiError(400, 'Project ID is required');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    // Check if user has permission to view the project
    // This can be expanded based on your permission model
    if (
      project.createdBy.toString() !== req.user.userId &&
      project.manager?.toString() !== req.user.userId &&
      !project.collaborators.some(
        (collab) =>
          (collab.user && collab.user.toString() === req.user.userId) ||
          collab.email === req.user.email,
      )
    ) {
      throw new ApiError(403, 'You do not have permission to view this project');
    }

    // Return collaborators
    const collaborators = project.collaborators || [];

    res
      .status(200)
      .json(new ApiResponse(200, collaborators, 'Collaborators retrieved successfully'));
  } catch (error) {
    next(error);
  }
};
