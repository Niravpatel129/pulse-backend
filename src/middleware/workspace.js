import Workspace from '../models/Workspace.js';
import ApiError from '../utils/apiError.js';

export const extractWorkspace = async (req, res, next) => {
  try {
    const host = req.headers.host || '';
    const domain = req?.headers?.origin?.split('://')[1] || '';
    const domainParts = host.split('.');
    const subdomain = domainParts[0];

    let workspace = null;

    workspace = await Workspace.findOne({
      isActive: true,
      $or: [{ subdomain }, { customDomains: domain || host }],
    });

    if (!workspace) {
      let workspaceIdentifier = req.headers.workspace;

      if (!workspaceIdentifier && req.path) {
        const pathParts = req.path.split('/');
        if (pathParts[1]) {
          workspaceIdentifier = pathParts[1];
        }
      }

      if (!workspaceIdentifier) {
        throw new ApiError(400, 'Workspace identifier is required');
      }

      workspace = await Workspace.findOne({
        isActive: true,
        $or: [
          { name: workspaceIdentifier },
          { subdomain: workspaceIdentifier },
          { customDomains: workspaceIdentifier },
        ],
      });

      if (!workspace) {
        throw new ApiError(404, 'Workspace not found');
      }
    }

    if (!req.user || !req.user.userId) {
      throw new ApiError(401, 'User not authenticated');
    }

    const isMember = workspace.members.some((m) => m.user.toString() === req.user.userId);

    if (!isMember) {
      throw new ApiError(403, 'You do not have access to this workspace');
    }

    req.workspace = workspace;
    next();
  } catch (error) {
    console.error('[extractWorkspace] Error:', error.message);
    next(error);
  }
};

export const extractWorkspaceWithoutAuth = async (req, res, next) => {
  try {
    const host = req.headers.host || '';
    const domain = req.headers?.origin?.split('://')[1] || req.headers.origin;
    const domainParts = host.split('.');
    const subdomain = domainParts[0];

    let workspace = null;

    workspace = await Workspace.findOne({
      isActive: true,
      $or: [{ subdomain }, { customDomains: domain || host }],
    });

    if (!workspace) {
      let workspaceIdentifier = req.headers.workspace;

      if (!workspaceIdentifier && req.path) {
        const pathParts = req.path.split('/');
        if (pathParts[1]) {
          workspaceIdentifier = pathParts[1];
        }
      }

      if (!workspaceIdentifier) {
        throw new ApiError(400, 'Workspace identifier is required');
      }

      workspace = await Workspace.findOne({
        isActive: true,
        $or: [
          { name: workspaceIdentifier },
          { subdomain: workspaceIdentifier },
          { customDomains: workspaceIdentifier },
        ],
      });

      if (!workspace) {
        throw new ApiError(404, 'Workspace not found');
      }
    }

    req.workspace = workspace;
    next();
  } catch (error) {
    console.error('[extractWorkspaceWithoutAuth] Error:', error.message);
    next(error);
  }
};
