import Participant from '../../models/Participant.js';
import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const addParticipant = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { participant } = req.body;

    if (!participant) {
      throw new ApiError(400, 'Participant data is required');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    const workspaceId = req.workspace._id;
    const userId = req.user.userId;

    // Check if a participant with the same email already exists
    let existingParticipant = null;
    if (participant.email) {
      existingParticipant = await Participant.findOne({
        email: participant.email,
        workspace: workspaceId,
      });
    }

    let participantId;

    if (existingParticipant) {
      participantId = existingParticipant._id;

      // Check if participant is already in the project
      const alreadyInProject = project.participants.find(
        (p) => p.participant.toString() === participantId.toString(),
      );

      if (alreadyInProject) {
        throw new ApiError(400, 'Participant is already in this project');
      }
    } else {
      // Create a new participant
      const { name, email, phone, dateAdded, notes, customFields } = participant;

      const newParticipant = await Participant.create({
        name,
        email,
        phone,
        dateAdded,
        comments: notes,
        customFields,
        workspace: workspaceId,
        createdBy: userId,
        project: projectId,
      });

      participantId = newParticipant._id;
    }

    // Add participant to project
    project.participants.push({
      participant: participantId,
    });

    await project.save();

    res.status(200).json(new ApiResponse(200, project, 'Participant added successfully'));
  } catch (error) {
    next(error);
  }
};
