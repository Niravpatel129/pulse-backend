import { google } from 'googleapis';
import asyncHandler from '../../../middleware/asyncHandler.js';
import ChatSettings from '../../../models/ChatSettings.js';
import GmailIntegration from '../../../models/GmailIntegration.js';
import gmailListenerService from '../../../services/gmailListenerService.js';

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

console.log('🔑 OAuth Configuration:', {
  clientId: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not Set',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not Set',
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
});

// @desc    Connect Gmail to workspace
// @route   POST /api/integrations/gmail/connect
// @access  Private
const connectGmail = asyncHandler(async (req, res) => {
  console.log('🔍 Starting Gmail connection process...');
  console.log('📝 Request body:', {
    hasCode: !!req.body.code,
    hasRedirectUri: !!req.body.redirectUri,
    hasState: !!req.body.state,
    hasWorkspaceId: !!req.body.workspaceId,
  });

  const { code, redirectUri, workspaceId } = req.body;

  if (!code) {
    console.error('❌ Missing authorization code');
    res.status(400);
    throw new Error('Authorization code is required');
  }

  if (!workspaceId) {
    console.error('❌ Missing workspace ID');
    res.status(400);
    throw new Error('Workspace identification is required. Please try again from your workspace.');
  }

  try {
    console.log('🔄 Attempting to exchange code for tokens...');
    console.log('🔑 OAuth Configuration:', {
      clientId: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not Set',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not Set',
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      frontendRedirectUri: redirectUri,
    });

    // Exchange code for tokens using the redirectUri from the frontend
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: redirectUri.startsWith('http') ? redirectUri : `https://${redirectUri}`,
    });

    console.log('✅ Successfully obtained tokens:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'Not set',
    });

    const { access_token, refresh_token, expiry_date } = tokens;

    // Set credentials to get user info
    oauth2Client.setCredentials(tokens);

    console.log('🔍 Fetching Gmail profile...');
    // Get user's Gmail profile
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const email = profile.data.emailAddress;
    console.log('✅ Gmail profile fetched:', { email });

    // Check if this Gmail account is already connected to this workspace
    console.log('🔍 Checking for existing integration...');
    const existingIntegration = await GmailIntegration.findOne({
      workspace: workspaceId,
      email,
    });

    let integration;

    if (existingIntegration) {
      console.log('📝 Updating existing integration...');
      // Update existing integration
      existingIntegration.accessToken = access_token;
      if (refresh_token) existingIntegration.refreshToken = refresh_token;
      existingIntegration.tokenExpiry = new Date(expiry_date);
      existingIntegration.isActive = true;
      existingIntegration.lastSynced = new Date();

      integration = await existingIntegration.save();
      console.log('✅ Existing integration updated');
    } else {
      console.log('📝 Creating new integration...');
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
      console.log('✅ New integration created');
    }

    console.log('🔄 Updating chat settings...');
    // Update chat settings to indicate Gmail is connected
    await ChatSettings.findOneAndUpdate(
      { workspace: workspaceId },
      { gmailConnected: true },
      { upsert: true },
    );
    console.log('✅ Chat settings updated');

    // Add the integration to the Gmail listener service
    console.log('🔄 Adding integration to Gmail listener service...');
    // Populate workspace information needed by the listener
    integration = await GmailIntegration.findById(integration._id).populate('workspace', 'name');
    await gmailListenerService.addIntegration(integration);
    console.log('✅ Integration added to listener service');

    res.status(200).json({
      success: true,
      message: 'Gmail connected successfully',
      email,
    });
  } catch (error) {
    console.error('❌ Gmail connection error:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
    });
    res.status(400);
    throw new Error(`Failed to connect Gmail: ${error.message}`);
  }
});

export default connectGmail;
