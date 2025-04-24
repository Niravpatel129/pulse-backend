import User from '../../models/User.js';
import Workspace from '../../models/Workspace.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * Revoke a pending workspace invitation and remove the user from workspace
 * @route DELETE /api/workspaces/invite/:inviteId
 * @param {string} req.params.inviteId - The token of the invitation to revoke
 * @access Private (Only workspace owners/admins)
 */
export const revokeWorkspaceInvitation = async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;
    const { inviteId } = req.params;

    // Get the workspace with its invitations
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      throw new ApiError(404, 'Workspace not found');
    }

    // Check if the invitation exists in the workspace
    const invitation = workspace.invitations.find((invitation) => invitation.token === inviteId);

    if (!invitation) {
      throw new ApiError(404, 'Invitation not found in this workspace');
    }

    // Check if user has permission to revoke invitations
    const requesterId = req.user.userId;
    const requesterMember = workspace.members.find(
      (member) => member.user.toString() === requesterId,
    );

    if (!requesterMember) {
      throw new ApiError(403, 'You do not have access to this workspace');
    }

    // Only owners and admins can revoke invitations
    if (requesterMember.role !== 'owner' && requesterMember.role !== 'admin') {
      throw new ApiError(403, 'You do not have permission to revoke invitations');
    }

    // Find the user associated with this invitation
    const user = await User.findOne({ email: invitation.email });

    if (user) {
      // Remove the member from workspace members array
      await Workspace.findByIdAndUpdate(
        workspaceId,
        { $pull: { members: { user: user._id } } },
        { runValidators: false },
      );
    }

    // Remove the invitation
    await Workspace.findByIdAndUpdate(
      workspaceId,
      { $pull: { invitations: { token: inviteId } } },
      { runValidators: false },
    );

    return res
      .status(200)
      .json(new ApiResponse(200, {}, 'Invitation revoked and user removed from workspace'));
  } catch (error) {
    console.log('❌ Error:', error);
    console.log('❌ Error stack:', error.stack);
    next(error);
  }
};
