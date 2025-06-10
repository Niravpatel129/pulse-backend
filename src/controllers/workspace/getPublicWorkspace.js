import ApiResponse from '../../utils/apiResponse.js';

/**
 * Get public workspace data for CMS landing pages
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getPublicWorkspace = async (req, res, next) => {
  try {
    const workspace = req.workspace;

    if (!workspace) {
      return res.status(404).json(new ApiResponse(404, null, 'Workspace not found'));
    }

    // Return only public-safe workspace data for CMS
    const publicWorkspaceData = {
      _id: workspace._id,
      name: workspace.name,
      description: workspace.description,
      subdomain: workspace.subdomain,
      logo: workspace.logo || '',
      workspaceFavicon: workspace.workspaceFavicon || '',
      customDomains: workspace.customDomains || [],
      // Add any CMS-specific fields here
      cmsEnabled: workspace.cmsEnabled || false,
      theme: workspace.theme || {},
      publicSettings: workspace.publicSettings || {},
    };

    return res
      .status(200)
      .json(
        new ApiResponse(200, publicWorkspaceData, 'Public workspace data retrieved successfully'),
      );
  } catch (error) {
    next(error);
  }
};
