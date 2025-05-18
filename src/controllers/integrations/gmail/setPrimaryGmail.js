import asyncHandler from '../../../middleware/asyncHandler.js';
import GmailIntegration from '../../../models/GmailIntegration.js';

// @desc    Set a Gmail account as primary for workspace
// @route   POST /api/integrations/gmail/set-primary
// @access  Private
const setPrimaryGmail = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }

  try {
    // Find the integration to set as primary
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

    // Check if it's already primary
    if (integration.isPrimary) {
      return res.status(200).json({
        success: true,
        message: `Gmail account ${email} is already set as primary`,
      });
    }

    // Find the current primary and update it
    await GmailIntegration.updateOne(
      { workspace: workspaceId, isPrimary: true },
      { isPrimary: false },
    );

    // Set the new primary
    integration.isPrimary = true;
    await integration.save();

    return res.status(200).json({
      success: true,
      message: `Gmail account ${email} set as primary successfully`,
    });
  } catch (error) {
    console.error('Error setting primary Gmail:', error);
    res.status(400);
    throw new Error(`Failed to set primary Gmail: ${error.message}`);
  }
});

export default setPrimaryGmail;
