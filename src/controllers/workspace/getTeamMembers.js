import Workspace from '../../models/Workspace.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getTeamMembers = async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;

    const teamMembers = await Workspace.findById(workspaceId).populate(
      'members.user',
      'name email',
    );

    res.status(200).json(new ApiResponse(200, teamMembers, 'Team members retrieved successfully'));
  } catch (error) {
    next(error);
  }
};
