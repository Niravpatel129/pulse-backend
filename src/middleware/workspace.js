import Workspace from '../models/Workspace.js';
import ApiError from '../utils/apiError.js';

export const extractWorkspace = async (req, res, next) => {
  try {
    console.log('🔍 Extracting workspace from request...');

    // Get workspace from header or URL path
    let workspaceIdentifier = req.headers.workspace;
    console.log('📝 Workspace identifier from header:', workspaceIdentifier);

    // Check the host (domain) to determine the workspace
    const host = req.headers.host || ''; // Get the host from the request headers
    const subdomain = host.split('.')[0]; // Extract subdomain from the host
    console.log('🌐 Host:', host, 'Subdomain:', subdomain);

    // If no workspaceIdentifier is passed, check if the domain matches any custom domain or subdomain
    if (!workspaceIdentifier) {
      console.log('🔎 No workspace identifier in header, searching by domain...');
      const workspace = await Workspace.findOne({
        $or: [
          { subdomain: subdomain }, // For hourblock-style subdomains
          { customDomains: host }, // For custom domains like pay.bolocreate.com
        ],
        isActive: true,
      });

      if (!workspace) {
        console.log('❌ No workspace found for domain');
        throw new ApiError(404, 'Workspace not found');
      }

      workspaceIdentifier = workspace.subdomain; // Use the subdomain of the found workspace
      console.log('✅ Found workspace by domain:', workspaceIdentifier);
    }

    if (!workspaceIdentifier) {
      console.log('❌ No workspace identifier available');
      throw new ApiError(400, 'Workspace identifier is required');
    }

    // Find workspace by name, subdomain, or slug
    console.log('🔍 Searching for workspace with identifier:', workspaceIdentifier);
    const workspace = await Workspace.findOne({
      $or: [
        { name: workspaceIdentifier },
        { subdomain: workspaceIdentifier },
        { slug: workspaceIdentifier },
      ],
      isActive: true,
    });

    if (!workspace) {
      console.log('❌ Workspace not found');
      throw new ApiError(404, 'Workspace not found');
    }
    console.log('✅ Found workspace:', workspace.name);

    // Check if user exists and is authenticated
    if (!req.user.userId) {
      console.log('❌ User not authenticated');
      throw new ApiError(401, 'User not authenticated');
    }

    // Check if user is a member of the workspace
    const isMember = workspace.members.some(
      (member) => member.user && member.user.toString() === req.user.userId,
    );

    if (!isMember) {
      console.log('❌ User is not a member of the workspace');
      throw new ApiError(403, 'You do not have access to this workspace');
    }

    // Attach workspace to request object
    req.workspace = workspace;
    console.log('✅ Successfully attached workspace to request');
    next();
  } catch (error) {
    console.log('❌ Error in extractWorkspace:', error.message);
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
