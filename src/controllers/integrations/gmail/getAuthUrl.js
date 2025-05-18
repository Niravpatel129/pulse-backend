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
    // Define the scopes we need for Gmail
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly', // Read-only access to Gmail
      'https://www.googleapis.com/auth/gmail.modify', // Modify but not delete messages
      'https://www.googleapis.com/auth/gmail.metadata', // Read metadata but not content
      'https://www.googleapis.com/auth/userinfo.email', // User email address
    ];

    // Generate the URL for OAuth consent flow
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Will return a refresh token
      scope: scopes,
      prompt: 'consent', // Force consent screen to get refresh token
      include_granted_scopes: true, // Include any previously granted scopes
      response_type: 'code',
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
