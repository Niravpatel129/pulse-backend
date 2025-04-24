import mongoose from 'mongoose';
import Workspace from '../../models/Workspace.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * Update a workspace member's role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateWorkspaceMember = async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;
    const memberId = req.params.memberId;
    const { role } = req.body;

    // Validate role
    const validRoles = ['owner', 'admin', 'member', 'moderator'];
    if (!role || !validRoles.includes(role)) {
      throw new ApiError(400, 'Invalid role. Must be one of: owner, admin, member, moderator');
    }

    // Validate memberId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      throw new ApiError(400, 'Invalid member ID format');
    }

    // Get the workspace with its members
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      throw new ApiError(404, 'Workspace not found');
    }

    // Check if the member exists in the workspace
    const memberToUpdate = workspace.members.find((member) => member.user.toString() === memberId);

    if (!memberToUpdate) {
      throw new ApiError(404, 'Member not found in this workspace');
    }

    // Safety check: Prevent changing the owner's role
    if (memberToUpdate.role === 'owner') {
      throw new ApiError(403, "Cannot change the workspace owner's role");
    }

    // Safety check: Make sure requester has appropriate permissions
    if (!req.user || !req.user.userId) {
      throw new ApiError(401, 'Authentication required');
    }

    const requesterId = req.user.userId;
    const requesterMember = workspace.members.find(
      (member) => member.user.toString() === requesterId,
    );

    if (!requesterMember) {
      throw new ApiError(403, 'You do not have access to this workspace');
    }

    // Only owners can change roles
    if (requesterMember.role !== 'owner') {
      throw new ApiError(403, 'Only workspace owners can change member roles');
    }

    // Update the member's role
    await Workspace.findOneAndUpdate(
      {
        _id: workspaceId,
        'members.user': memberId,
      },
      {
        $set: { 'members.$.role': role },
      },
      { runValidators: true },
    );

    return res.status(200).json(new ApiResponse(200, { role }, 'Member role updated successfully'));
  } catch (error) {
    console.log('❌ Error:', error);
    console.log('❌ Error stack:', error.stack);
    next(error);
  }
};
