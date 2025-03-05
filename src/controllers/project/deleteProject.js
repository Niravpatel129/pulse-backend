import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

// Delete project
export const deleteProject = async (req, res, next) => {
  try {
    const projectId = req.params.id;

    // Check if project exists
    const project = await Project.findById(projectId);

    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Check if user has permission to delete the project
    // Only project creator or manager should be able to delete
    if (
      project.createdBy.toString() !== req.user.userId &&
      project.manager?.toString() !== req.user.userId
    ) {
      throw new ApiError(403, 'You do not have permission to delete this project');
    }

    // Delete the project
    await Project.findByIdAndDelete(projectId);

    return res.status(200).json(new ApiResponse(200, { message: 'Project deleted successfully' }));
  } catch (error) {
    next(error);
  }
};
