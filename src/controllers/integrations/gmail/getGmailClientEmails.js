import { google } from 'googleapis';
import asyncHandler from '../../../middleware/asyncHandler.js';
import Client from '../../../models/Client.js';
import GmailIntegration from '../../../models/GmailIntegration.js';

// Helper function to decode base64url encoded strings
const decodeBase64Url = (str) => {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
};

// Helper function to recursively find attachments and body in MIME parts
const processEmailParts = (parts) => {
  if (!parts) return { body: '', attachments: [] };

  const attachments = [];
  let body = '';

  const processPart = (part) => {
    if (part.filename && part.filename.length > 0) {
      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size,
        isInline:
          part.headers?.some(
            (h) =>
              h.name.toLowerCase() === 'content-disposition' &&
              h.value.toLowerCase().includes('inline'),
          ) || false,
      });
    } else if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
      // Decode the body content
      const content = part.body.data ? decodeBase64Url(part.body.data) : '';
      if (part.mimeType === 'text/plain') {
        // For plain text, preserve line breaks
        body = content;
      } else {
        // For HTML, we'll keep it as is for the frontend to render
        body = content;
      }
    }

    // Recursively process nested parts
    if (part.parts) {
      part.parts.forEach(processPart);
    }
  };

  parts.forEach(processPart);
  return { body, attachments };
};

/**
 * @desc    Get emails from connected Gmail account for a specific client
 * @route   GET /api/gmail/client/:clientId/emails
 * @access  Private
 */
const getGmailClientEmails = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const { clientId } = req.params;

  console.log(`[DEBUG] Getting emails for client: ${clientId} in workspace: ${workspaceId}`);

  // Get pagination parameters from query
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;

  // Verify client exists and belongs to the workspace
  const client = await Client.findById(clientId).select('+email');
  const clientEmail = client.user.email;
  console.log('🚀 client:', client);

  if (!client) {
    res.status(404);
    throw new Error('Client not found');
  }

  if (!clientEmail) {
    res.status(400);
    throw new Error('Client does not have an email address');
  }

  console.log(`[DEBUG] Found client email: ${clientEmail}`);

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
    // Build search query to find emails related to this client
    const searchQuery = `from:${clientEmail}`;
    console.log(`[DEBUG] Using search query: "${searchQuery}"`);

    // Build parameters for Gmail API
    const listParams = {
      userId: 'me',
      maxResults: 50, // Increased to get more results
      q: searchQuery,
    };

    // Get list of emails with pagination
    console.log(`[DEBUG] Calling Gmail API with params:`, listParams);
    const response = await gmail.users.messages.list(listParams);
    console.log(`[DEBUG] Gmail API response:`, JSON.stringify(response.data, null, 2));

    const messages = response.data.messages || [];
    console.log(`[DEBUG] Found ${messages.length} messages matching query`);

    // If no messages found, try a test query to verify API access
    if (messages.length === 0) {
      console.log(`[DEBUG] Testing with a simple search to verify API works`);
      const testResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 1,
      });
      console.log(`[DEBUG] Test response:`, JSON.stringify(testResponse.data, null, 2));
    }

    // Group messages by thread
    const threadMap = new Map();

    for (const message of messages) {
      console.log(`[DEBUG] Fetching details for message ID: ${message.id}`);
      try {
        const email = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full', // Get full message details including body
        });

        // Extract headers
        const headers = email.data.payload.headers;
        const getHeader = (name) =>
          headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        // Process email body and attachments
        const { body, attachments } = processEmailParts([email.data.payload]);

        // Create streamlined email object
        const streamlinedEmail = {
          id: message.id,
          threadId: message.threadId,
          snippet: email.data.snippet,
          labelIds: email.data.labelIds,
          from: getHeader('From'),
          to: getHeader('To'),
          cc: getHeader('Cc'),
          bcc: getHeader('Bcc'),
          subject: getHeader('Subject'),
          date: getHeader('Date'),
          messageId: getHeader('Message-ID'),
          inReplyTo: getHeader('In-Reply-To'),
          references: getHeader('References'),
          body,
          bodyType: email.data.payload.mimeType,
          attachments,
          hasAttachment: attachments.length > 0,
          hasInlineAttachment: attachments.some((att) => att.isInline),
          hasRegularAttachment: attachments.some((att) => !att.isInline),
        };

        // Add to thread map
        if (!threadMap.has(message.threadId)) {
          threadMap.set(message.threadId, {
            threadId: message.threadId,
            messages: [],
            subject: streamlinedEmail.subject,
            snippet: streamlinedEmail.snippet,
            date: streamlinedEmail.date,
            participants: new Set([
              streamlinedEmail.from,
              ...streamlinedEmail.to.split(','),
              ...(streamlinedEmail.cc || '').split(','),
              ...(streamlinedEmail.bcc || '').split(','),
            ]),
            hasAttachment: streamlinedEmail.hasAttachment,
            hasInlineAttachment: streamlinedEmail.hasInlineAttachment,
            hasRegularAttachment: streamlinedEmail.hasRegularAttachment,
            labelIds: streamlinedEmail.labelIds,
          });
        }

        const thread = threadMap.get(message.threadId);
        thread.messages.push(streamlinedEmail);

        // Update thread metadata
        thread.date =
          new Date(streamlinedEmail.date) > new Date(thread.date)
            ? streamlinedEmail.date
            : thread.date;
        thread.hasAttachment = thread.hasAttachment || streamlinedEmail.hasAttachment;
        thread.hasInlineAttachment =
          thread.hasInlineAttachment || streamlinedEmail.hasInlineAttachment;
        thread.hasRegularAttachment =
          thread.hasRegularAttachment || streamlinedEmail.hasRegularAttachment;
        thread.labelIds = [...new Set([...thread.labelIds, ...streamlinedEmail.labelIds])];

        // Add participants
        streamlinedEmail.to.split(',').forEach((to) => thread.participants.add(to));
        if (streamlinedEmail.cc) {
          streamlinedEmail.cc.split(',').forEach((cc) => thread.participants.add(cc));
        }
        if (streamlinedEmail.bcc) {
          streamlinedEmail.bcc.split(',').forEach((bcc) => thread.participants.add(bcc));
        }
        thread.participants.add(streamlinedEmail.from);
      } catch (msgError) {
        console.error(`[DEBUG] Error fetching message ${message.id}:`, msgError);
        // Continue with other messages
      }
    }

    // Convert thread map to array and sort by date
    const threads = Array.from(threadMap.values())
      .map((thread) => ({
        ...thread,
        participants: Array.from(thread.participants).filter(Boolean),
        messageCount: thread.messages.length,
        // Sort messages within thread by date
        messages: thread.messages.sort((a, b) => new Date(b.date) - new Date(a.date)),
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log(`[DEBUG] Successfully processed ${threads.length} threads`);

    res.status(200).json({
      success: true,
      data: {
        clientId,
        clientEmail,
        threads,
        nextPageToken: response.data.nextPageToken || null,
        resultSizeEstimate: response.data.resultSizeEstimate || 0,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('[DEBUG] Gmail API Error:', error);
    if (error.response) {
      console.error('[DEBUG] Error response:', error.response.data);
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

export default getGmailClientEmails;
