import { google } from 'googleapis';
import asyncHandler from '../../../middleware/asyncHandler.js';
import GmailIntegration from '../../../models/GmailIntegration.js';

// Helper function to decode base64url encoded strings
const decodeBase64Url = (str) => {
  if (!str) return '';
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
};

/**
 * @desc    Get a Gmail attachment by message ID and attachment ID
 * @route   GET /api/gmail/messages/:messageId/attachments/:attachmentId
 * @access  Private
 */
const getGmailAttachment = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const { messageId, attachmentId } = req.params;

  console.log(
    `[DEBUG] Fetching attachment - Message ID: ${messageId}, Attachment ID: ${attachmentId}`,
  );

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
    // Get the message first to find the attachment metadata
    console.log('[DEBUG] Fetching message data to find attachment metadata...');
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    console.log('[DEBUG] Successfully fetched message data');

    // Find the attachment part in the message
    const findAttachmentPart = (parts) => {
      if (!parts) return null;

      for (const part of parts) {
        // Check if this part is the attachment we're looking for
        if (part.body?.attachmentId === attachmentId) {
          return part;
        }

        // Check nested parts
        if (part.parts) {
          const found = findAttachmentPart(part.parts);
          if (found) return found;
        }
      }
      return null;
    };

    // Start search from the message payload
    const attachmentPart = findAttachmentPart([message.data.payload]);
    if (!attachmentPart) {
      console.log('[DEBUG] Attachment part not found in message payload');
      res.status(404);
      throw new Error('Attachment not found in message');
    }

    // Get the attachment data
    console.log('[DEBUG] Fetching attachment data from Gmail API...');
    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });
    console.log('[DEBUG] Successfully fetched attachment data');

    // Decode the attachment data
    const attachmentData = decodeBase64Url(attachment.data.data);

    // Get content type and filename from headers
    const contentType =
      attachmentPart.headers?.find((h) => h.name.toLowerCase() === 'content-type')?.value ||
      attachmentPart.mimeType;

    const contentDisposition = attachmentPart.headers?.find(
      (h) => h.name.toLowerCase() === 'content-disposition',
    )?.value;

    let filename = attachmentPart.filename;
    if (!filename && contentDisposition) {
      const matches = contentDisposition.match(/filename="([^"]+)"/);
      if (matches) {
        filename = matches[1];
      }
    }

    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', attachmentData.length);

    console.log('[DEBUG] Sending attachment response with headers:', {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': attachmentData.length,
    });

    // Send the attachment
    res.send(attachmentData);
  } catch (error) {
    console.error('[DEBUG] Gmail API Error:', error);
    if (error.response) {
      console.error('[DEBUG] Error response data:', error.response.data);
    }
    res.status(500);
    throw new Error(`Failed to download attachment: ${error.message}`);
  }
});

export default getGmailAttachment;
