import crypto from 'crypto';
import User from '../../models/User.js';
import Workspace from '../../models/Workspace.js';
import emailService from '../../services/emailService.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * Invite a member to join a workspace
 * @route POST /api/workspaces/:workspaceId/invite
 * @access Private (Only workspace owners/admins)
 */
export const inviteMemberToWorkspace = async (req, res, next) => {
  try {
    const workspaceId = req.workspace?._id;
    const { email, role = 'client' } = req.body;

    if (!email) {
      throw new ApiError(400, 'Email is required');
    }

    // Validate role
    const validRoles = ['owner', 'admin', 'moderator', 'client'];
    const normalizedRole = role.toLowerCase();

    if (!validRoles.includes(normalizedRole)) {
      throw new ApiError(400, 'Invalid role. Must be one of: owner, admin, moderator, client');
    }

    // Check if workspace exists - make sure to select the subdomain field too
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new ApiError(404, 'Workspace not found');
    }

    // Ensure subdomain is present
    if (!workspace.subdomain) {
      // Generate subdomain from workspace name
      const generatedSubdomain = workspace.name
        .toLowerCase()
        .replace(/\s+/g, '-') // Replace spaces with dashes
        .replace(/[^a-z0-9-]/g, ''); // Remove special characters

      workspace.subdomain = generatedSubdomain;

      // Save the workspace with the new subdomain
      try {
        await workspace.save();
      } catch (error) {
        // If there's an error (like duplicate subdomain), add a random string
        if (error.code === 11000) {
          // MongoDB duplicate key error
          workspace.subdomain = `${generatedSubdomain}-${crypto.randomBytes(3).toString('hex')}`;
          await workspace.save();
        } else {
          throw error;
        }
      }
    }

    // Check if user has permission to invite
    const isOwner = workspace.members.some(
      (member) => member.user.toString() === req.user.userId && member.role === 'owner',
    );
    const isAdmin = workspace.members.some(
      (member) => member.user.toString() === req.user.userId && member.role === 'admin',
    );

    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'You do not have permission to invite users to this workspace');
    }

    // Check if user already exists
    let existingUser = await User.findOne({ email });

    if (existingUser) {
      // Check if user is already a member of the workspace
      const isMember = workspace.members.some(
        (member) => member.user.toString() === existingUser._id.toString(),
      );

      if (isMember) {
        throw new ApiError(400, 'User is already a member of this workspace');
      }

      // Add user to workspace
      workspace.members.push({
        user: existingUser._id,
        role: normalizedRole,
      });

      await workspace.save();

      // Send notification email for invited user
      await emailService.sendEmail({
        to: email,
        subject: `You've been added to ${workspace.name}`,
        html: `<p>You have been added to the workspace "${workspace.name}" with the role of ${normalizedRole}.</p>`,
      });

      return res
        .status(200)
        .json(new ApiResponse(200, { workspace }, 'User added to workspace successfully'));
    } else {
      // Create a temporary user account
      const username = email.split('@')[0] + '-' + crypto.randomBytes(4).toString('hex');

      // Create new user with temporary credentials
      existingUser = await User.create({
        email,
        username,
        isEmailVerified: false,
        needsPasswordChange: true,
      });

      // Generate invitation token
      const invitationToken = crypto.randomBytes(20).toString('hex');

      // Add user to workspace
      workspace.members.push({
        user: existingUser._id,
        role: normalizedRole,
      });

      // Check if workspace schema has invitations field, if not, initialize it
      if (!workspace.invitations) {
        workspace.invitations = [];
      }

      // Add invitation to workspace
      workspace.invitations.push({
        email,
        role: normalizedRole,
        token: invitationToken,
        invitedBy: req.user.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      await workspace.save();

      // Send invitation email with account setup instructions
      const inviteUrl = `${process.env.FRONTEND_URL}/invite/workspace/${invitationToken}`;

      await emailService.sendEmail({
        to: email,
        subject: `Invitation to join ${workspace.name}`,
        html: `
          <p>You have been invited to join the workspace "${workspace.name}" with the role of ${normalizedRole}.</p>
          <p>An account has been created for you with the username: ${username}</p>
          <p>Click the following link to accept the invitation and set up your password: <a href="${inviteUrl}">${inviteUrl}</a></p>
        `,
      });

      return res
        .status(200)
        .json(new ApiResponse(200, { workspace }, 'User created and invitation sent successfully'));
    }
  } catch (error) {
    next(error);
  }
};
