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
    const workspaceId = req.workspace._id;

    const workspace = await Workspace.findById(workspaceId).populate('members.user');

    if (!workspace) {
      console.log('❌ Workspace not found for ID:', workspaceId);
      throw new ApiError(404, 'Workspace not found or you do not have access');
    }

    return res
      .status(200)
      .json(new ApiResponse(200, workspace.members, 'Workspace members retrieved successfully'));
  } catch (error) {
    console.log('🚀 error:', error);
    console.log('❌ Error stack:', error.stack);
    next(error);
  }
};
