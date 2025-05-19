import { google } from 'googleapis';
import asyncHandler from '../../../middleware/asyncHandler.js';
import ChatSettings from '../../../models/ChatSettings.js';
import GmailIntegration from '../../../models/GmailIntegration.js';
import Workspace from '../../../models/Workspace.js';
import gmailListenerService from '../../../services/gmailListenerService.js';

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

// @desc    Connect Gmail to workspace
// @route   POST /api/integrations/gmail/connect
// @access  Private
const connectGmail = asyncHandler(async (req, res) => {
  const { code, redirectUri, state } = req.body;

  // Get workspace from request or from state parameter
  let workspaceId;
  let workspaceSubdomain;

  if (req.workspace) {
    // If request has workspace context, use it
    workspaceId = req.workspace._id;
  } else if (state) {
    // Extract workspace info from state
    try {
      const decodedState = decodeURIComponent(state);
      const stateData = JSON.parse(decodedState);
      workspaceId = stateData.workspaceId;
      workspaceSubdomain = stateData.subdomain;

      // If we have subdomain but no workspaceId, try to find workspace by subdomain
      if (!workspaceId && workspaceSubdomain) {
        const workspace = await Workspace.findOne({ subdomain: workspaceSubdomain });
        if (workspace) {
          workspaceId = workspace._id;
        }
      }
    } catch (error) {
      console.error('Error parsing state:', error);
    }
  }

  if (!code) {
    res.status(400);
    throw new Error('Authorization code is required');
  }

  if (!workspaceId) {
    res.status(400);
    throw new Error('Workspace identification is required. Please try again from your workspace.');
  }

  try {
    // Exchange code for tokens using the redirectUri from the frontend
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: redirectUri,
    });

    const { access_token, refresh_token, expiry_date } = tokens;

    // Set credentials to get user info
    oauth2Client.setCredentials(tokens);

    // Get user's Gmail profile
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const email = profile.data.emailAddress;

    // Check if this Gmail account is already connected to this workspace
    const existingIntegration = await GmailIntegration.findOne({
      workspace: workspaceId,
      email,
    });

    let integration;

    if (existingIntegration) {
      // Update existing integration
      existingIntegration.accessToken = access_token;
      if (refresh_token) existingIntegration.refreshToken = refresh_token;
      existingIntegration.tokenExpiry = new Date(expiry_date);
      existingIntegration.isActive = true;
      existingIntegration.lastSynced = new Date();

      integration = await existingIntegration.save();
    } else {
      // Check if there are any existing integrations
      const existingCount = await GmailIntegration.countDocuments({ workspace: workspaceId });

      // Create new integration
      integration = await GmailIntegration.create({
        workspace: workspaceId,
        email,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry: new Date(expiry_date),
        isPrimary: existingCount === 0, // Set as primary if this is the first integration
      });
    }

    // Update chat settings to indicate Gmail is connected
    await ChatSettings.findOneAndUpdate(
      { workspace: workspaceId },
      { gmailConnected: true },
      { upsert: true },
    );

    // Add the integration to the Gmail listener service
    // Populate workspace information needed by the listener
    integration = await GmailIntegration.findById(integration._id).populate('workspace', 'name');
    await gmailListenerService.addIntegration(integration);

    res.status(200).json({
      success: true,
      message: 'Gmail connected successfully',
      email,
    });
  } catch (error) {
    console.error('Gmail connection error:', error);
    res.status(400);
    throw new Error(`Failed to connect Gmail: ${error.message}`);
  }
});

export default connectGmail;
