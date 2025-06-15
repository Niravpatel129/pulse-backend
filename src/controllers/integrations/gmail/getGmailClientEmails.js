import { google } from 'googleapis';
import asyncHandler from '../../../middleware/asyncHandler.js';
import Client from '../../../models/Client.js';
import GmailIntegration from '../../../models/GmailIntegration.js';
import buildOauthClient from '../../../utils/googleOAuth.js';

// Helper function to decode base64url encoded strings
export const decodeBase64Url = (str) => {
  if (!str) return '';
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
};

// Helper function to get image data URL
export const getImageDataUrl = (mimeType, data) => {
  return `data:${mimeType};base64,${data}`;
};

// Helper function to recursively find attachments and body in MIME parts
export const processEmailParts = async (parts, gmail, messageId) => {
  if (!parts) return { body: '', attachments: [], inlineImages: [] };

  const attachments = [];
  const inlineImages = [];
  let body = '';
  let bodyText = '';

  const processPart = async (part) => {
    if (part.filename && part.filename.length > 0) {
      try {
        // Get attachment data
        const attachment = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: messageId,
          id: part.body.attachmentId,
        });

        const attachmentData = attachment.data.data;
        const decodedData = decodeBase64Url(attachmentData);

        // Check if this is an inline image
        const isInline =
          part.headers?.some(
            (h) =>
              h.name.toLowerCase() === 'content-disposition' &&
              h.value.toLowerCase().includes('inline'),
          ) || false;

        const isImage = part.mimeType.startsWith('image/');

        if (isInline && isImage) {
          // Handle inline image
          const contentId = part.headers
            ?.find((h) => h.name.toLowerCase() === 'content-id')
            ?.value?.replace(/[<>]/g, '');

          inlineImages.push({
            id: part.body.attachmentId,
            contentId,
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size,
            data: decodedData,
            dataUrl: getImageDataUrl(part.mimeType, attachmentData),
            downloadUrl: `/api/gmail/messages/${messageId}/attachments/${part.body.attachmentId}`,
          });
        } else {
          // Handle regular attachment
          attachments.push({
            id: part.body.attachmentId,
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size,
            data: decodedData,
            isInline,
            contentType: part.mimeType,
            downloadUrl: `/api/gmail/messages/${messageId}/attachments/${part.body.attachmentId}`,
          });
        }
      } catch (error) {
        console.error(`Error fetching attachment ${part.filename}:`, error);
      }
    } else if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
      // Decode the body content
      const content = part.body.data ? decodeBase64Url(part.body.data) : '';

      if (part.mimeType === 'text/plain') {
        // For plain text, preserve line breaks
        bodyText = content;
      } else if (part.mimeType === 'text/html') {
        // For HTML, we'll keep it as is for the frontend to render
        body = content;
      }
    } else if (part.mimeType === 'multipart/alternative' || part.mimeType === 'multipart/mixed') {
      // Process nested parts for multipart messages
      if (part.parts) {
        for (const nestedPart of part.parts) {
          await processPart(nestedPart);
        }
      }
    }

    // Recursively process nested parts
    if (part.parts) {
      for (const nestedPart of part.parts) {
        await processPart(nestedPart);
      }
    }
  };

  for (const part of parts) {
    await processPart(part);
  }

  // If no HTML body was found, use plain text
  if (!body && bodyText) {
    body = bodyText;
  }

  return { body, attachments, inlineImages };
};

/**
 * @desc    Get emails from connected Gmail account for a specific client
 * @route   GET /api/gmail/client/:clientId/emails
 * @access  Private
 */
const getGmailClientEmails = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const { clientId } = req.params;

  // Get pagination parameters from query
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;

  // Verify client exists and belongs to the workspace
  const client = await Client.findById(clientId).select('+email');
  const clientEmail = client.user.email;

  if (!client) {
    res.status(404);
    throw new Error('Client not found');
  }

  if (!clientEmail) {
    res.status(400);
    throw new Error('Client does not have an email address');
  }

  // Find Gmail integration for this workspace
  const gmailIntegration = await GmailIntegration.findOne({
    workspace: workspaceId,
    isActive: true,
  });

  if (!gmailIntegration) {
    res.status(400);
    throw new Error('Gmail not connected for this workspace');
  }

  // Build OAuth2 client (persists refreshed tokens)
  const oauth2Client = buildOauthClient(gmailIntegration);

  // Create Gmail client
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    // Build search query to find emails related to this client
    const searchQuery = `from:${clientEmail} OR to:${clientEmail}`;

    // Build parameters for Gmail API
    const listParams = {
      userId: 'me',
      maxResults: 50,
      q: searchQuery,
    };

    // Get list of emails with pagination
    const response = await gmail.users.messages.list(listParams);
    const messages = response.data.messages || [];

    // If no messages found, try a test query to verify API access
    if (messages.length === 0) {
      const testResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 1,
      });
    }

    // Group messages by thread
    const threadMap = new Map();

    for (const message of messages) {
      try {
        const email = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full',
        });

        // Extract headers
        const headers = email.data.payload.headers;
        const getHeader = (name) =>
          headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        // Process email body and attachments
        const { body, attachments, inlineImages } = await processEmailParts(
          [email.data.payload],
          gmail,
          message.id,
        );

        // Create streamlined email object
        const streamlinedEmail = {
          id: message.id,
          threadId: message.threadId,
          key: `${message.threadId}-${message.id}`,
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
          attachments: attachments.map((att) => ({
            ...att,
            data: undefined,
            downloadUrl: `/api/gmail/messages/${message.id}/attachments/${att.id}`,
          })),
          inlineImages: inlineImages.map((img) => ({
            ...img,
            data: undefined,
            dataUrl: img.dataUrl,
          })),
          hasAttachment: attachments.length > 0,
          hasInlineAttachment: attachments.some((att) => att.isInline),
          hasRegularAttachment: attachments.some((att) => !att.isInline),
          hasInlineImages: inlineImages.length > 0,
        };

        // Add to thread map
        if (!threadMap.has(message.threadId)) {
          threadMap.set(message.threadId, {
            threadId: message.threadId,
            key: message.threadId,
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
        console.error(`Error fetching message ${message.id}:`, msgError);
      }
    }

    // Convert thread map to array and sort by date
    const threads = Array.from(threadMap.values())
      .map((thread) => ({
        ...thread,
        participants: Array.from(thread.participants).filter(Boolean),
        messageCount: thread.messages.length,
        messages: thread.messages.sort((a, b) => new Date(b.date) - new Date(a.date)),
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

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
    console.error('Gmail API Error:', error);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

export default getGmailClientEmails;
