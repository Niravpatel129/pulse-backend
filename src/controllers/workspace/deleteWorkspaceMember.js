import mongoose from 'mongoose';
import Workspace from '../../models/Workspace.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * Delete a member from a workspace
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const deleteWorkspaceMember = async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;
    const memberId = req.params.memberId;

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
    const memberIndex = workspace.members.findIndex(
      (member) => member.user.toString() === memberId,
    );

    if (memberIndex === -1) {
      throw new ApiError(404, 'Member not found in this workspace');
    }

    // Safety check: Prevent deleting the owner of the workspace
    if (workspace.members[memberIndex].role === 'owner') {
      throw new ApiError(403, 'Cannot remove the workspace owner');
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

    // Only owners and admins can remove members
    if (
      requesterMember.role !== 'owner' &&
      requesterMember.role !== 'admin' &&
      requesterMember.role !== 'moderator'
    ) {
      throw new ApiError(403, 'You do not have permission to remove members');
    }

    // cannot remove yourself
    if (requesterId === memberId) {
      throw new ApiError(400, 'You cannot remove yourself');
    }

    // Remove the member using $pull operator (which doesn't trigger validation on other fields)
    await Workspace.findByIdAndUpdate(
      workspaceId,
      { $pull: { members: { user: new mongoose.Types.ObjectId(memberId) } } },
      { runValidators: false },
    );

    return res
      .status(200)
      .json(new ApiResponse(200, {}, 'Member removed successfully from workspace'));
  } catch (error) {
    console.log('❌ Error:', error);
    console.log('❌ Error stack:', error.stack);
    next(error);
  }
};
