import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getParticipants = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      throw new ApiError(400, 'Project ID is required');
    }

    const project = await Project.findById(projectId).populate('participants.participant');

    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    res
      .status(200)
      .json(new ApiResponse(200, project.participants, 'Participants retrieved successfully'));
  } catch (error) {
    next(error);
  }
};
