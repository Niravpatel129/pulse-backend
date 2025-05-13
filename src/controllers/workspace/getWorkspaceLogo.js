import ApiResponse from '../../utils/apiResponse.js';

/**
 * Get the workspace logo
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getWorkspaceLogo = async (req, res, next) => {
  try {
    const workspace = req.workspace;

    if (!workspace) {
      return res.status(404).json(new ApiResponse(404, null, 'Workspace not found'));
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          logo: workspace.logo || '',
          favicon: workspace.workspaceFavicon || '',
        },
        'Workspace logo retrieved successfully',
      ),
    );
  } catch (error) {
    next(error);
  }
};
