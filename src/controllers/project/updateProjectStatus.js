import Project from '../../models/Project.js';
import ProjectAlert from '../../models/ProjectAlert.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

// Update project status
export const updateProjectStatus = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { status } = req.body;

    // Validate input
    if (!status) {
      throw new ApiError(400, 'Status is required');
    }

    // Check if project exists
    const project = await Project.findById(projectId);

    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Check if user has permission to update the project status
    // Only project creator, manager, or team members should be able to update status
    if (
      project.createdBy.toString() !== req.user.userId &&
      project.manager?.toString() !== req.user.userId
    ) {
      throw new ApiError(403, 'You do not have permission to update this project status');
    }

    // Update the project status
    project.isClosed = status === 'closed';
    project.isArchived = status === 'archived';
    project.isOpen = status === 'open';
    await project.save();

    // update alerts
    await ProjectAlert.updateMany(
      { project: projectId },
      { $set: { isDismissed: true, isVisibleAlert: false } },
    );

    return res
      .status(200)
      .json(new ApiResponse(200, { project }, 'Project status updated successfully'));
  } catch (error) {
    next(error);
  }
};
