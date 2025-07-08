import Workspace from '../../models/Workspace.js';
import ApiResponse from '../../utils/apiResponse.js';

// Helper function to normalize domain by removing www prefix
const normalizeDomain = (domain) => {
  if (!domain) return domain;
  return domain.replace(/^www\./, '');
};

// Helper function to generate domain variations (with and without www)
const getDomainVariations = (domain) => {
  if (!domain) return [];
  const normalized = normalizeDomain(domain);
  return [normalized, `www.${normalized}`];
};

const getWorkspaceByUrl = async (req, res, next) => {
  try {
    const { domain, subdomain } = req.query;

    if (!domain) {
      return res.status(400).json(new ApiResponse(400, null, 'Domain is required'));
    }

    // Generate domain variations for flexible matching
    const domainVariations = getDomainVariations(domain);

    // Build query based on both domain and subdomain
    const query = {
      $or: [{ customDomains: { $in: domainVariations } }, { subdomain: subdomain }],
    };

    // If both domain and subdomain are provided, we can be more specific
    if (domain && subdomain) {
      query.$and = [
        {
          $or: [{ customDomains: { $in: domainVariations } }, { subdomain: subdomain }],
        },
      ];
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
