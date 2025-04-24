import User from '../../models/User.js';
import Workspace from '../../models/Workspace.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * Verify a workspace invitation token
 * @route GET /api/workspaces/invite/verify/:token
 * @access Public
 */
export const verifyWorkspaceInvitation = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      throw new ApiError(400, 'Invitation token is required');
    }

    // Find workspace with matching invitation token
    const workspace = await Workspace.findOne({
      'invitations.token': token,
    });

    if (!workspace) {
      throw new ApiError(404, 'Invalid or expired invitation');
    }

    // Find the specific invitation
    const invitation = workspace.invitations.find((inv) => inv.token === token);

    if (!invitation) {
      throw new ApiError(404, 'Invitation not found');
    }

    // Check if invitation is expired
    if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
      throw new ApiError(400, 'Invitation has expired');
    }

    // Find the user associated with the invitation
    const user = await User.findOne({ email: invitation.email });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          invitation: {
            email: invitation.email,
            role: invitation.role,
            workspace: {
              id: workspace._id,
              name: workspace.name,
            },
            userId: user._id,
            needsPasswordChange: user.needsPasswordChange,
          },
        },
        'Invitation is valid',
      ),
    );
  } catch (error) {
    next(error);
  }
};
