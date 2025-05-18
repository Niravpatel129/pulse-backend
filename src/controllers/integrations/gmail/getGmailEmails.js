import { google } from 'googleapis';
import asyncHandler from '../../../middleware/asyncHandler.js';
import GmailIntegration from '../../../models/GmailIntegration.js';

/**
 * @desc    Get emails from connected Gmail account
 * @route   GET /api/gmail/emails
 * @access  Private
 */
const getGmailEmails = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;

  // Find Gmail integration for this workspace
  const gmailIntegration = await GmailIntegration.findOne({
    workspace: workspaceId,
    isActive: true,
  });

  if (!gmailIntegration) {
    res.status(400);
    throw new Error('Gmail not connected for this workspace');
  }

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  // Set credentials
  oauth2Client.setCredentials({
    access_token: gmailIntegration.accessToken,
    refresh_token: gmailIntegration.refreshToken,
  });

  // Log the full token object to verify scopes
  console.log('Token Object:', oauth2Client.credentials);

  // Create Gmail client
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    // Get list of emails (10 most recent)
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
    });

    const messages = response.data.messages || [];
    const emails = [];

    for (const message of messages) {
      const email = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
      });

      emails.push(email.data);
    }

    res.status(200).json({
      success: true,
      data: {
        emails,
      },
    });
  } catch (error) {
    console.error('Gmail API Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default getGmailEmails;
