import Participant from '../../models/Participant.js';
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

    const participant = await Participant.findOne({
      _id: participantId,
      workspace: workspaceId,
    });

    if (!participant) {
      throw new ApiError(404, 'Participant not found');
    }

    participant.project = projectId;
    await participant.save();

    return res
      .status(200)
      .json(new ApiResponse(200, participant, 'Participant added to project successfully'));
  } catch (error) {
    next(error);
  }
};
