import { google } from 'googleapis';
import asyncHandler from '../../../middleware/asyncHandler.js';

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

// @desc    Get Gmail authorization URL
// @route   GET /api/gmail/auth-url
// @access  Private
const getAuthUrl = asyncHandler(async (req, res) => {
  try {
    // Get workspace ID from request
    const workspaceId = req.workspace?._id;
    const workspaceSubdomain = req.headers.host?.split('.')[0] || '';

    // Define the scopes we need for Gmail
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly', // Read-only access to Gmail
      'https://www.googleapis.com/auth/userinfo.email', // User email address
    ];

    // Create state object with workspace info
    const state = JSON.stringify({
      type: 'gmail_auth',
      workspaceId: workspaceId?.toString(),
      subdomain: workspaceSubdomain,
    });

    // Generate the URL for OAuth consent flow
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Will return a refresh token
      scope: scopes,
      prompt: 'consent', // Force consent screen to get refresh token
      include_granted_scopes: true, // Include any previously granted scopes
      response_type: 'code',
      state: state, // OAuth client will handle encoding
    });

    res.status(200).json({
      success: true,
      authUrl,
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500);
    throw new Error(`Failed to generate authentication URL: ${error.message}`);
  }
});

export default getAuthUrl;
