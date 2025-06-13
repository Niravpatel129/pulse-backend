import Workspace from '../../models/Workspace.js';
import ApiResponse from '../../utils/apiResponse.js';

const getWorkspaceByUrl = async (req, res, next) => {
  try {
    const { domain, subdomain } = req.query;

    if (!domain) {
      return res.status(400).json(new ApiResponse(400, null, 'Domain is required'));
    }

    // Build query based on both domain and subdomain
    const query = {
      $or: [{ customDomains: domain }, { subdomain: subdomain }],
    };

    // If both domain and subdomain are provided, we can be more specific
    if (domain && subdomain) {
      query.$and = [{ $or: [{ customDomains: domain }, { subdomain: subdomain }] }];
    }

    const workspace = await Workspace.findOne(query);

    if (!workspace) {
      return res.status(404).json(new ApiResponse(404, null, 'Workspace not found'));
    }

    // Return only necessary workspace data
    const workspaceData = {
      _id: workspace._id,
      name: workspace.name,
      subdomain: workspace.subdomain,
      customDomains: workspace.customDomains || [],
      logo: workspace.logo || '',
      workspaceFavicon: workspace.workspaceFavicon || '',
    };

    return res
      .status(200)
      .json(new ApiResponse(200, workspaceData, 'Workspace found successfully'));
  } catch (error) {
    next(error);
  }
};

export default getWorkspaceByUrl;
