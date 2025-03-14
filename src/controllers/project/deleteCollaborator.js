import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const deleteCollaborator = async (req, res, next) => {
  try {
    const { projectId, collaboratorId } = req.params;

    if (!projectId || !collaboratorId) {
      throw new ApiError(400, 'Project ID and Collaborator ID are required');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    // Check if collaborator exists in the project
    const collaboratorIndex = project.collaborators.findIndex(
      (c) => c._id.toString() === collaboratorId,
    );

    if (collaboratorIndex === -1) {
      throw new ApiError(404, 'Collaborator not found in this project');
    }

    // Remove collaborator from project
    project.collaborators.splice(collaboratorIndex, 1);
    await project.save();

    res.status(200).json(new ApiResponse(200, project, 'Collaborator removed successfully'));
  } catch (error) {
    next(error);
  }
};
