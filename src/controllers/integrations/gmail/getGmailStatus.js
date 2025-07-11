import asyncHandler from '../../../middleware/asyncHandler.js';
import GmailIntegration from '../../../models/GmailIntegration.js';

// @desc    Get Gmail integration status for workspace
// @route   GET /api/integrations/gmail/status
// @access  Private
const getGmailStatus = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;

  try {
    // Find all Gmail integrations for this workspace
    const integrations = await GmailIntegration.find({
      workspace: workspaceId,
    }).select('email isPrimary isActive lastSynced tokenExpiry createdAt refreshTokenLastUsedAt');

    if (!integrations || integrations.length === 0) {
      return res.status(200).json({
        connected: false,
        message: 'No Gmail accounts connected to this workspace',
        integrations: [],
      });
    }

    // Process integrations to include token expiry status
    const processedIntegrations = integrations.map((integration) => {
      const isExpired = integration.tokenExpiry < new Date();

      // Re-auth is needed if the short-lived access token is expired AND we have
      // never successfully used (or stored) the refresh token to get a new one.
      // If refreshTokenLastUsedAt is absent, it means we have not refreshed yet.
      const needsReauth = isExpired && !integration.refreshTokenLastUsedAt;

      return {
        email: integration.email,
        isPrimary: integration.isPrimary,
        isActive: integration.isActive,
        lastSynced: integration.lastSynced,
        isExpired: needsReauth,
        connectedAt: integration.createdAt,
      };
    });

    // Find primary email
    const primaryIntegration = processedIntegrations.find((int) => int.isPrimary);

    return res.status(200).json({
      connected: true,
      message: 'Gmail integration status retrieved',
      primaryEmail: primaryIntegration ? primaryIntegration.email : null,
      integrations: processedIntegrations,
    });
  } catch (error) {
    console.error('Error getting Gmail status:', error);
    res.status(400);
    throw new Error(`Failed to get Gmail status: ${error.message}`);
  }
});

export default getGmailStatus;
