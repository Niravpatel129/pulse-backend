import Participant from '../../models/Participant.js';
import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const updateParticipant = async (req, res, next) => {
  try {
    const { projectId, participantId } = req.params;
    const { updates } = req.body;

    if (!projectId || !participantId) {
      throw new ApiError(400, 'Project ID and Participant ID are required');
    }

    if (!updates) {
      throw new ApiError(400, 'Updates are required');
    }

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    const workspaceId = req.workspace._id;

    // Verify the project exists
    const project = await Project.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Check if participant exists in the project
    const participantInProject = project.participants.find(
      (p) => p.participant.toString() === participantId,
    );

    if (!participantInProject) {
      throw new ApiError(404, 'Participant not found in this project');
    }

    // Process customFields from array format to Map format
    const updatesToApply = { ...updates };
    if (updates.customFields && Array.isArray(updates.customFields)) {
      const customFieldsMap = new Map();
      updates.customFields.forEach((field) => {
        if (field.key && field.value !== undefined) {
          customFieldsMap.set(field.key, field.value);
        }
      });

      // Convert Map to Object for Mongoose
      updatesToApply.customFields = Object.fromEntries(customFieldsMap);
    }

    // Find and update the participant
    const participant = await Participant.findOneAndUpdate(
      { _id: participantId, workspaces: workspaceId },
      { $set: updatesToApply },
      { new: true },
    );

    if (!participant) {
      throw new ApiError(404, 'Participant not found');
    }

    res.status(200).json(new ApiResponse(200, participant, 'Participant updated successfully'));
  } catch (error) {
    next(error);
  }
};
