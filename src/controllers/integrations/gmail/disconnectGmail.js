import asyncHandler from '../../../middleware/asyncHandler.js';
import ChatSettings from '../../../models/ChatSettings.js';
import GmailIntegration from '../../../models/GmailIntegration.js';
import gmailListenerService from '../../../services/gmailListenerService.js';

// @desc    Disconnect Gmail from workspace
// @route   POST /api/integrations/gmail/disconnect
// @access  Private
const disconnectGmail = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const { email } = req.body;

  try {
    // If email is provided, disconnect that specific email
    if (email) {
      const integration = await GmailIntegration.findOne({
        workspace: workspaceId,
        email,
      });

      if (!integration) {
        return res.status(404).json({
          success: false,
          message: `Gmail account ${email} not found for this workspace`,
        });
      }

      // If this is the primary email and there are others, need to set a new primary
      if (integration.isPrimary) {
        const otherEmail = await GmailIntegration.findOne({
          workspace: workspaceId,
          email: { $ne: email },
          isActive: true,
        });

        if (otherEmail) {
          otherEmail.isPrimary = true;
          await otherEmail.save();
        }
      }

      // Remove from Gmail listener service
      gmailListenerService.removeIntegration(workspaceId.toString(), email);

      await integration.deleteOne();

      // Check if there are any remaining Gmail integrations
      const remainingCount = await GmailIntegration.countDocuments({
        workspace: workspaceId,
        isActive: true,
      });

      // If no more active integrations, update chat settings
      if (remainingCount === 0) {
        await ChatSettings.findOneAndUpdate({ workspace: workspaceId }, { gmailConnected: false });
      }

      return res.status(200).json({
        success: true,
        message: `Gmail account ${email} disconnected successfully`,
        hasRemainingConnections: remainingCount > 0,
      });
    }
    // If no email is provided, disconnect all Gmail accounts for this workspace
    else {
      // Get all integrations for this workspace before deleting them
      const integrations = await GmailIntegration.find({ workspace: workspaceId });

      // Remove all from Gmail listener service
      for (const integration of integrations) {
        gmailListenerService.removeIntegration(workspaceId.toString(), integration.email);
      }

      await GmailIntegration.deleteMany({ workspace: workspaceId });

      // Update chat settings
      await ChatSettings.findOneAndUpdate({ workspace: workspaceId }, { gmailConnected: false });

      return res.status(200).json({
        success: true,
        message: 'All Gmail accounts disconnected successfully',
        hasRemainingConnections: false,
      });
    }
  } catch (error) {
    console.error('Gmail disconnection error:', error);
    res.status(400);
    throw new Error(`Failed to disconnect Gmail: ${error.message}`);
  }
});

export default disconnectGmail;
