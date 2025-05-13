import Workspace from '../models/Workspace.js';
import ApiError from '../utils/apiError.js';

export const extractWorkspace = async (req, res, next) => {
  try {
    console.log('🔍 [extractWorkspace] start');

    // 1. Header
    let workspaceIdentifier = req.headers.workspace;
    console.log(`📝 [extractWorkspace] from header: ${workspaceIdentifier}`);

    // 2. Host
    const host = req.headers.host || '';
    console.log(`🌐 [extractWorkspace] host: ${host}`);

    // 3. Subdomain (first label)
    const domainParts = host.split('.');
    const subdomain = domainParts[0];
    console.log(`🔖 [extractWorkspace] subdomain: ${subdomain}`);

    // 4. If no identifier yet, try host matching
    if (!workspaceIdentifier) {
      console.log('⏩ [extractWorkspace] no header, trying host as workspaceIdentifier');
      workspaceIdentifier = host; // full host for customDomains
      console.log(`🆔 [extractWorkspace] now identifier = full host: ${workspaceIdentifier}`);
    }

    // 5. Fallback to path
    if (!workspaceIdentifier && req.path) {
      const pathParts = req.path.split('/');
      if (pathParts[1]) {
        workspaceIdentifier = pathParts[1];
        console.log(`↪️ [extractWorkspace] fallback to path: ${workspaceIdentifier}`);
      }
    }

    if (!workspaceIdentifier) {
      console.error('❌ [extractWorkspace] no workspace identifier found');
      throw new ApiError(400, 'Workspace identifier is required');
    }

    // 6. Log search criteria
    console.log(`🔍 [extractWorkspace] looking for workspace matching:`, {
      name: workspaceIdentifier,
      subdomain: workspaceIdentifier,
      customDomains: workspaceIdentifier,
    });

    // 7. Query
    const workspace = await Workspace.findOne({
      isActive: true,
      $or: [
        { name: workspaceIdentifier },
        { subdomain: workspaceIdentifier },
        { customDomains: workspaceIdentifier },
      ],
    });

    if (!workspace) {
      console.error(
        `❌ [extractWorkspace] no workspace found for identifier: ${workspaceIdentifier}`,
      );
      throw new ApiError(404, 'Workspace not found');
    }
    console.log(`✅ [extractWorkspace] found workspace: ${workspace._id} (${workspace.name})`);

    // 8. Auth check
    if (!req.user || !req.user.userId) {
      console.error('❌ [extractWorkspace] user not authenticated');
      throw new ApiError(401, 'User not authenticated');
    }

    // 9. Membership check
    const isMember = workspace.members.some((member) => member.user.toString() === req.user.userId);
    console.log(`👥 [extractWorkspace] isMember: ${isMember}`);

    if (!isMember) {
      console.error('❌ [extractWorkspace] user not a member');
      throw new ApiError(403, 'You do not have access to this workspace');
    }

    // 10. Attach and continue
    req.workspace = workspace;
    console.log('🚀 [extractWorkspace] attached workspace, calling next()');
    next();
  } catch (error) {
    console.error('💥 [extractWorkspace] error:', error);
    next(error);
  }
};

export const requireWorkspaceRole = (roles) => (req, res, next) => {
  try {
    console.log('🔍 [requireWorkspaceRole] start, roles:', roles);

    if (!req.workspace) {
      console.error('❌ [requireWorkspaceRole] missing workspace on req');
      throw new ApiError(400, 'Workspace context is required');
    }

    if (!req.user || !req.user._id) {
      console.error('❌ [requireWorkspaceRole] user not authenticated');
      throw new ApiError(401, 'User not authenticated');
    }

    const member = req.workspace.members.find((m) => m.user.toString() === req.user._id.toString());
    console.log(`👤 [requireWorkspaceRole] found member:`, member);

    if (!member) {
      console.error('❌ [requireWorkspaceRole] user not a member');
      throw new ApiError(403, 'You are not a member of this workspace');
    }

    if (!roles.includes(member.role)) {
      console.error(`❌ [requireWorkspaceRole] insufficient role: ${member.role}`);
      throw new ApiError(403, 'Insufficient permissions in this workspace');
    }

    console.log('✅ [requireWorkspaceRole] role check passed, calling next()');
    next();
  } catch (error) {
    console.error('💥 [requireWorkspaceRole] error:', error);
    next(error);
  }
};
