import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const deleteParticipant = async (req, res, next) => {
  try {
    const { projectId, participantId } = req.params;

    if (!projectId || !participantId) {
      throw new ApiError(400, 'Project ID and Participant ID are required');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    // Check if participant exists in the project
    const participantIndex = project.participants.findIndex(
      (p) => p.participant.toString() === participantId,
    );

    if (participantIndex === -1) {
      throw new ApiError(404, 'Participant not found in this project');
    }

    // Remove participant from project
    project.participants.splice(participantIndex, 1);
    await project.save();

    res.status(200).json(new ApiResponse(200, project, 'Participant removed successfully'));
  } catch (error) {
    next(error);
  }
};
