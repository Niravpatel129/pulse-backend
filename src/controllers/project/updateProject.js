import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const updateProject = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const { name, type: projectType, leadSource, stage, description, status, manager } = req.body;

    // Check if project exists
    const project = await Project.findById(projectId);

    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Check if user has permission to update the project
    // Only project creator or manager should be able to update
    if (
      project.createdBy.toString() !== req.user.userId &&
      project.manager?.toString() !== req.user.userId
    ) {
      throw new ApiError(403, 'You do not have permission to update this project');
    }

    // Update project fields
    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      {
        name,
        projectType,
        leadSource,
        stage,
        description,
        status,
        manager,
      },
      { new: true, runValidators: true },
    ).populate('manager', 'name email');

    return res.status(200).json(new ApiResponse(200, updatedProject));
  } catch (error) {
    next(error);
  }
};
