import Workspace from '../../models/Workspace.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * Get the current workspace details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getCurrentWorkspace = async (req, res, next) => {
  try {
    const workspace = req.workspace;

    if (!workspace) {
      return res.status(404).json(new ApiResponse(404, null, 'Workspace not found'));
    }

    // Populate members with user details
    const workspaceData = await Workspace.findById(workspace._id).select(
      'name slug subdomain logo customDomains',
    );

    return res
      .status(200)
      .json(new ApiResponse(200, workspaceData, 'Current workspace retrieved successfully'));
  } catch (error) {
    next(error);
  }
};
