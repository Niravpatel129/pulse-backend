import Workspace from '../models/Workspace.js';
import ApiError from '../utils/apiError.js';

export const extractWorkspace = async (req, res, next) => {
  try {
    // Get workspace from header or URL path
    let workspaceIdentifier = req.headers.workspace;
    console.log('🚀 workspaceIdentifier:', workspaceIdentifier);

    // If no workspace in header, try to get from URL path
    if (!workspaceIdentifier && req.path) {
      const pathParts = req.path.split('/');
      if (pathParts.length > 1 && pathParts[1]) {
        workspaceIdentifier = pathParts[1];
      }
    }

    if (!workspaceIdentifier) {
      throw new ApiError(400, 'Workspace identifier is required');
    }

    // Find workspace by name (subdomain)
    const workspace = await Workspace.findOne({
      $or: [
        { name: workspaceIdentifier },
        { subdomain: workspaceIdentifier },
        { slug: workspaceIdentifier },
      ],
      isActive: true,
    });

    if (!workspace) {
      throw new ApiError(404, 'Workspace not found');
    }

    // Check if user exists and is authenticated
    if (!req.user.userId) {
      throw new ApiError(401, 'User not authenticated');
    }

    // Check if user is a member of the workspace
    const isMember = workspace.members.some(
      (member) => member.user && member.user.toString() === req.user.userId,
    );

    if (!isMember) {
      throw new ApiError(403, 'You do not have access to this workspace');
    }

    // Attach workspace to request object
    req.workspace = workspace;
    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to ensure user has specific role in workspace
export const requireWorkspaceRole = (roles) => {
  return (req, res, next) => {
    try {
      if (!req.workspace) {
        throw new ApiError(400, 'Workspace context is required');
      }

      // Check if user exists and is authenticated
      if (!req.user || !req.user._id) {
        throw new ApiError(401, 'User not authenticated');
      }

      const member = req.workspace.members.find(
        (m) => m.user && m.user.toString() === req.user._id.toString(),
      );

      if (!member) {
        throw new ApiError(403, 'You are not a member of this workspace');
      }

      if (!roles.includes(member.role)) {
        throw new ApiError(403, 'Insufficient permissions in this workspace');
      }

      next();
    } catch (error) {
      console.log('🚀 error:', error);
      next(error);
    }
  };
};
