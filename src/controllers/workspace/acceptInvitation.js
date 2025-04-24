import User from '../../models/User.js';
import Workspace from '../../models/Workspace.js';
import authService from '../../services/authService.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * Accept/verify a workspace invitation
 * @route POST /api/workspaces/invite/accept/:token
 * @access Public
 */
export const acceptWorkspaceInvitation = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

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
    const invitationIndex = workspace.invitations.findIndex((inv) => inv.token === token);

    if (invitationIndex === -1) {
      throw new ApiError(404, 'Invitation not found');
    }

    const invitation = workspace.invitations[invitationIndex];

    // Check if invitation is expired
    if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
      throw new ApiError(400, 'Invitation has expired');
    }

    // Find the user associated with the invitation
    const user = await User.findOne({ email: invitation.email }).select('+password');

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Update user password if provided and needed
    if (user.needsPasswordChange && password) {
      user.password = password;
      user.needsPasswordChange = false;
      user.isEmailVerified = true;
      await user.save();
    }

    // Remove the invitation from the workspace once verified
    workspace.invitations.splice(invitationIndex, 1);
    await workspace.save();

    // Generate authentication token
    const authToken = authService.generateToken(user._id, user.email);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          token: authToken,
          user: {
            _id: user._id,
            email: user.email,
            username: user.username,
          },
          workspace: {
            _id: workspace._id,
            name: workspace.name,
          },
        },
        'Access verified successfully',
      ),
    );
  } catch (error) {
    next(error);
  }
};
