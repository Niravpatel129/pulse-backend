import Workspace from '../../models/Workspace.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getTeamMembers = async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;

    // Fetch workspace with populated members
    const workspace = await Workspace.findById(workspaceId)
      .populate('members.user', 'name email avatar role needsPasswordChange')
      .populate('invitations.invitedBy', 'name email');

    if (!workspace) {
      return res.status(404).json(new ApiResponse(404, null, 'Workspace not found'));
    }

    // Format response data
    const responseData = {
      members: workspace.members,
      invitations: workspace.invitations.map((invitation) => ({
        email: invitation.email,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        expiresAt: invitation.expiresAt,
        token: invitation.token,
      })),
    };

    res
      .status(200)
      .json(
        new ApiResponse(200, responseData, 'Team members and invitations retrieved successfully'),
      );
  } catch (error) {
    next(error);
  }
};
