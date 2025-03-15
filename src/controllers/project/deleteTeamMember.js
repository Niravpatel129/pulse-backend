import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const deleteTeamMember = async (req, res, next) => {
  try {
    const { projectId, teamMemberId } = req.params;

    if (!projectId || !teamMemberId) {
      throw new ApiError(400, 'Project ID and Team Member ID are required');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    // First try to find and remove from team members
    const teamMemberIndex = project.team.findIndex((t) => t.user.toString() === teamMemberId);

    if (teamMemberIndex !== -1) {
      // Remove team member from project
      project.team.splice(teamMemberIndex, 1);
      await project.save();
      return res.status(200).json(
        new ApiResponse(200, {
          type: 'team_member',
          message: 'Team member removed successfully',
        }),
      );
    }

    // If not found in team, try participants
    const participantIndex = project.participants.findIndex(
      (p) => p.participant.toString() === teamMemberId,
    );

    if (participantIndex !== -1) {
      // Remove participant from project
      project.participants.splice(participantIndex, 1);
      await project.save();
      return res.status(200).json(
        new ApiResponse(200, {
          type: 'participant',
          message: 'Participant removed successfully',
        }),
      );
    }

    // If not found in participants, try collaborators
    const collaboratorIndex = project.collaborators.findIndex(
      (c) => c._id.toString() === teamMemberId,
    );

    if (collaboratorIndex !== -1) {
      // Remove collaborator from project
      project.collaborators.splice(collaboratorIndex, 1);
      await project.save();
      return res.status(200).json(
        new ApiResponse(200, {
          type: 'collaborator',
          message: 'Collaborator removed successfully',
        }),
      );
    }

    // If we get here, the team member wasn't found
    throw new ApiError(404, 'Team member not found in this project');
  } catch (error) {
    next(error);
  }
};
