import { google } from 'googleapis';
import mime from 'mime-types';
import asyncHandler from '../../../middleware/asyncHandler.js';
import GmailIntegration from '../../../models/GmailIntegration.js';

// Helper function to decode base64url encoded strings
const decodeBase64Url = (str) => {
  if (!str) return '';
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
};

// Helper function to extract filename from content disposition
const extractFilename = (contentDisposition) => {
  if (!contentDisposition) return null;

  // Try to extract filename from content-disposition header
  const matches = contentDisposition.match(/filename="([^"]+)"/);
  if (matches && matches[1]) {
    return matches[1];
  }

  // Try to extract filename from filename* parameter (RFC 5987)
  const filenameStar = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
  if (filenameStar && filenameStar[1]) {
    try {
      return decodeURIComponent(filenameStar[1]);
    } catch {
      return null;
    }
  }

  return null;
};

// Helper function to determine content type
const determineContentType = (part, defaultType = 'application/octet-stream') => {
  // First try to get from content-type header
  const contentTypeHeader = part.headers?.find(
    (h) => h.name.toLowerCase() === 'content-type',
  )?.value;

  if (contentTypeHeader) {
    // Extract mime type from content-type header (remove charset and other parameters)
    const mimeType = contentTypeHeader.split(';')[0].trim();
    if (mimeType) return mimeType;
  }

  // Then try to get from mimeType property
  if (part.mimeType) return part.mimeType;

  // If filename exists, try to determine from extension
  if (part.filename) {
    const mimeType = mime.lookup(part.filename);
    if (mimeType) return mimeType;
  }

  return defaultType;
};

// Helper function to find attachment part
const findAttachmentPart = (parts, attachmentId) => {
  if (!parts) return null;

  console.log('[DEBUG] Searching for attachment ID:', attachmentId);
  console.log(
    '[DEBUG] Available parts:',
    JSON.stringify(
      parts.map((p) => ({
        partId: p.partId,
        mimeType: p.mimeType,
        filename: p.filename,
        attachmentId: p.body?.attachmentId,
        hasParts: !!p.parts,
      })),
      null,
      2,
    ),
  );

  // First, try to find an exact match
  for (const part of parts) {
    // Debug log for each part
    console.log('[DEBUG] Checking part:', {
      partId: part.partId,
      mimeType: part.mimeType,
      filename: part.filename,
      attachmentId: part.body?.attachmentId,
      headers: part.headers?.map((h) => `${h.name}: ${h.value}`),
    });

    // Check if this part is the attachment we're looking for
    if (part.body?.attachmentId === attachmentId) {
      console.log('[DEBUG] Found exact matching attachment part:', {
        partId: part.partId,
        mimeType: part.mimeType,
        filename: part.filename,
        attachmentId: part.body.attachmentId,
      });
      return part;
    }

    // Check nested parts
    if (part.parts) {
      console.log('[DEBUG] Checking nested parts for part:', part.partId);
      const found = findAttachmentPart(part.parts, attachmentId);
      if (found) return found;
    }
  }

  // If no exact match found, try to find any attachment
  console.log('[DEBUG] No exact match found, looking for any attachment...');
  for (const part of parts) {
    if (part.body?.attachmentId) {
      console.log('[DEBUG] Found alternative attachment:', {
        partId: part.partId,
        mimeType: part.mimeType,
        filename: part.filename,
        attachmentId: part.body.attachmentId,
      });
      return part;
    }
    if (part.parts) {
      const found = findAttachmentPart(part.parts, attachmentId);
      if (found) return found;
    }
  }

  return null;
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
  console.log('[DEBUG] Attachment ID length:', attachmentId.length);

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

    // Start search from the message payload
    const attachmentPart = findAttachmentPart([message.data.payload], attachmentId);
    if (!attachmentPart) {
      console.log('[DEBUG] No attachment found in message payload');
      console.log('[DEBUG] Available parts:', JSON.stringify(message.data.payload?.parts, null, 2));
      console.log('[DEBUG] Looking for attachment ID:', attachmentId);
      console.log(
        '[DEBUG] Available attachment IDs:',
        message.data.payload?.parts?.map((p) => ({
          filename: p.filename,
          attachmentId: p.body?.attachmentId,
          matches: p.body?.attachmentId === attachmentId,
        })),
      );
      res.status(404);
      throw new Error('Attachment not found in message');
    }

    // Get the attachment data using the found attachment ID
    const actualAttachmentId = attachmentPart.body.attachmentId;
    console.log('[DEBUG] Using attachment ID:', actualAttachmentId);

    // Get the attachment data
    console.log('[DEBUG] Fetching attachment data from Gmail API...');
    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: actualAttachmentId,
    });
    console.log('[DEBUG] Successfully fetched attachment data');

    // Decode the attachment data
    const attachmentData = decodeBase64Url(attachment.data.data);

    // Get content type and filename
    const contentType = determineContentType(attachmentPart);
    const contentDisposition = attachmentPart.headers?.find(
      (h) => h.name.toLowerCase() === 'content-disposition',
    )?.value;

    let filename = attachmentPart.filename;
    if (!filename) {
      filename = extractFilename(contentDisposition);
    }

    // If still no filename, generate one based on content type
    if (!filename) {
      const extension = mime.extension(contentType) || 'bin';
      filename = `attachment_${Date.now()}.${extension}`;
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
