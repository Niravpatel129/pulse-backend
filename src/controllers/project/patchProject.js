import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const patchProject = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const updateFields = {};

    // Only include fields that are provided in the request body
    const allowedFields = [
      'name',
      'type',
      'leadSource',
      'stage',
      'description',
      'status',
      'manager',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        // Handle special case for 'type' field which maps to 'projectType' in the model
        if (field === 'type') {
          updateFields.projectType = req.body[field];
        } else {
          updateFields[field] = req.body[field];
        }
      }
    });

    // If no fields to update, return early
    if (Object.keys(updateFields).length === 0) {
      throw new ApiError(400, 'No valid fields provided for update');
    }

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

    // Update only the provided fields
    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { $set: updateFields },
      { new: true, runValidators: true },
    ).populate('manager', 'name email');

    return res.status(200).json(new ApiResponse(200, updatedProject));
  } catch (error) {
    next(error);
  }
};
