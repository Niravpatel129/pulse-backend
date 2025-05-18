import { google } from 'googleapis';
import asyncHandler from '../../../middleware/asyncHandler.js';
import GmailIntegration from '../../../models/GmailIntegration.js';

/**
 * @desc    Get emails from connected Gmail account with pagination and search
 * @route   GET /api/gmail/emails
 * @access  Private
 */
const getGmailEmails = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;

  // Get pagination parameters from query
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const searchQuery = req.query.query || '';

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

  // Create Gmail client
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    // Calculate pagination values
    const maxResults = pageSize;
    const pageToken = req.query.pageToken || null;

    // Build parameters for Gmail API
    const listParams = {
      userId: 'me',
      maxResults,
    };

    // Add pageToken if available (for pagination)
    if (pageToken) {
      listParams.pageToken = pageToken;
    }

    // Add search query if provided
    if (searchQuery) {
      listParams.q = searchQuery;
    }

    // Get list of emails with pagination and search
    const response = await gmail.users.messages.list(listParams);

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
        nextPageToken: response.data.nextPageToken || null,
        resultSizeEstimate: response.data.resultSizeEstimate || 0,
        page,
        pageSize,
        query: searchQuery,
      },
    });
  } catch (error) {
    console.error('Gmail API Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default getGmailEmails;
