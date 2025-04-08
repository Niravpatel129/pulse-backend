import Participant from '../../models/Participant.js';
import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const addExistingParticipantToProject = async (req, res, next) => {
  try {
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    const { participantId, projectId } = req.body;

    if (!participantId || !projectId) {
      throw new ApiError(400, 'Participant ID and Project ID are required');
    }

    const workspaceId = req.workspace._id;

    // Find both the participant and project
    const [participant, project] = await Promise.all([
      Participant.findOne({
        _id: participantId,
        workspaces: workspaceId,
      }),
      Project.findById(projectId),
    ]);

    if (!participant) {
      throw new ApiError(404, 'Participant not found');
    }

    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Check if participant is already in the project
    const alreadyInProject = project.participants.find(
      (p) => p.participant.toString() === participantId.toString(),
    );

    if (alreadyInProject) {
      return res
        .status(200)
        .json(new ApiResponse(200, participant, 'Participant is already in this project'));
    }

    // Add participant to project's participants array
    project.participants.push({
      participant: participantId,
    });
    await project.save();

    // Update participant's project reference
    participant.project = projectId;
    await participant.save();

    return res
      .status(200)
      .json(new ApiResponse(200, participant, 'Participant added to project successfully'));
  } catch (error) {
    next(error);
  }
};
