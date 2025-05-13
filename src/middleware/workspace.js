import Workspace from '../models/Workspace.js';
import ApiError from '../utils/apiError.js';

export const extractWorkspace = async (req, res, next) => {
  try {
    console.log('🔍 [extractWorkspace] start');

    const host = req.headers.host || '';
    const domain = req.headers.domain || '';
    console.log(`🌐 [extractWorkspace] host: ${host}, domain: ${domain}`);

    const domainParts = host.split('.');
    const subdomain = domainParts[0];
    console.log(`🔖 [extractWorkspace] subdomain label: ${subdomain}`);

    let workspace = null;

    // 1️⃣ Try host-based lookup first (covers both *.hourblock.com and fully custom domains)
    console.log('⏩ [extractWorkspace] attempting host-based lookup');
    workspace = await Workspace.findOne({
      isActive: true,
      $or: [
        { subdomain }, // legacy subdomains, e.g. bolo.hourblock.com
        { customDomains: domain || host }, // full custom domain from header or host
      ],
    });

    if (workspace) {
      console.log(
        `✅ [extractWorkspace] host-based matched workspace: ${workspace._id} (${workspace.name})`,
      );
    } else {
      // 2️⃣ Fallback: header → path
      let workspaceIdentifier = req.headers.workspace;
      console.log(`📝 [extractWorkspace] from header: ${workspaceIdentifier}`);

      if (!workspaceIdentifier && req.path) {
        const pathParts = req.path.split('/');
        if (pathParts[1]) {
          workspaceIdentifier = pathParts[1];
          console.log(`↪️ [extractWorkspace] from path: ${workspaceIdentifier}`);
        }
      }

      if (!workspaceIdentifier) {
        console.error('❌ [extractWorkspace] no identifier from host, header, or path');
        throw new ApiError(400, 'Workspace identifier is required');
      }

      console.log(
        `🔍 [extractWorkspace] header/path lookup for identifier: ${workspaceIdentifier}`,
      );
      workspace = await Workspace.findOne({
        isActive: true,
        $or: [
          { name: workspaceIdentifier },
          { subdomain: workspaceIdentifier },
          { customDomains: workspaceIdentifier },
        ],
      });

      if (workspace) {
        console.log(
          `✅ [extractWorkspace] header/path matched workspace: ${workspace._id} (${workspace.name})`,
        );
      } else {
        console.error(
          `❌ [extractWorkspace] no workspace found for identifier: ${workspaceIdentifier}`,
        );
        throw new ApiError(404, 'Workspace not found');
      }
    }

    // 3️⃣ Auth & membership checks
    if (!req.user || !req.user.userId) {
      console.error('❌ [extractWorkspace] user not authenticated');
      throw new ApiError(401, 'User not authenticated');
    }

    const isMember = workspace.members.some((m) => m.user.toString() === req.user.userId);
    console.log(`👥 [extractWorkspace] isMember: ${isMember}`);

    if (!isMember) {
      console.error('❌ [extractWorkspace] user not a member');
      throw new ApiError(403, 'You do not have access to this workspace');
    }

    req.workspace = workspace;
    console.log('🚀 [extractWorkspace] attached workspace, next()');
    next();
  } catch (error) {
    console.error('💥 [extractWorkspace] error:', error);
    next(error);
  }
};
