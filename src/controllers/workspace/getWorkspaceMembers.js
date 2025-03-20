import Workspace from '../../models/Workspace.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * Get all members of a workspace
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getWorkspaceMembers = async (req, res, next) => {
  try {
    console.log('🚀 getWorkspaceMembers: Function started');
    console.log('🚀 Request user:', req.user);

    const workspaceId = req.workspace._id;

    // Find the workspace and populate user data for each member
    console.log('🚀 Finding workspace in database...');
    const workspace = await Workspace.findById(workspaceId).populate('members.user');

    if (!workspace) {
      console.log('❌ Workspace not found for ID:', workspaceId);
      throw new ApiError(404, 'Workspace not found or you do not have access');
    }
    console.log('🚀 Total members found:', workspace.members.length);
    console.log(
      '🚀 Member roles distribution:',
      workspace.members.reduce((acc, member) => {
        acc[member.role] = (acc[member.role] || 0) + 1;
        return acc;
      }, {}),
    );

    // Return the members array with populated user data
    console.log('🚀 Sending response with workspace members');
    return res
      .status(200)
      .json(new ApiResponse(200, workspace.members, 'Workspace members retrieved successfully'));
  } catch (error) {
    console.log('🚀 error:', error);
    console.log('❌ Error stack:', error.stack);
    next(error);
  }
};
