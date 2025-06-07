import { google } from 'googleapis';
import GmailIntegration from '../models/GmailIntegration.js';

// Create Gmail API client
const createGmailClient = (accessToken) => {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
};

// Get Gmail client for a workspace
export const getGmailClient = async (workspaceId, fromEmail = null) => {
  const query = {
    workspace: workspaceId,
    isActive: true,
  };

  // If fromEmail is provided, use that specific integration
  if (fromEmail) {
    query.email = fromEmail;
  } else {
    // Otherwise use the primary integration
    query.isPrimary = true;
  }

  const integration = await GmailIntegration.findOne(query);

  if (!integration) {
    throw new Error(
      fromEmail
        ? `No active Gmail integration found for email ${fromEmail}`
        : 'No active primary Gmail integration found for this workspace',
    );
  }

  // Check if token needs refresh
  if (new Date() >= integration.tokenExpiry) {
    // TODO: Implement token refresh logic
    throw new Error('Gmail token expired and needs refresh');
  }

  return {
    client: createGmailClient(integration.accessToken),
    integration,
  };
};

// Send email using Gmail API
export const sendGmailEmail = async (gmailClient, emailData) => {
  const { to, cc, bcc, subject, html, attachments = [] } = emailData;

  // Create email message
  const message = [
    'Content-Type: multipart/mixed; boundary="foo_bar_baz"\r\n',
    'MIME-Version: 1.0\r\n',
    `To: ${to}\r\n`,
    cc ? `Cc: ${cc}\r\n` : '',
    `Subject: ${subject}\r\n\r\n`,
    '--foo_bar_baz\r\n',
    'Content-Type: multipart/alternative; boundary="foo_bar_baz_alt"\r\n\r\n',
    '--foo_bar_baz_alt\r\n',
    'Content-Type: text/html; charset="UTF-8"\r\n\r\n',
    html,
    '\r\n\r\n',
    '--foo_bar_baz_alt--\r\n\r\n',
  ].join('');

  // Add attachments if any
  if (attachments.length > 0) {
    for (const attachment of attachments) {
      message.push(
        '--foo_bar_baz\r\n',
        `Content-Type: ${attachment.mimeType}\r\n`,
        'Content-Transfer-Encoding: base64\r\n',
        `Content-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n`,
        attachment.content.toString('base64'),
        '\r\n\r\n',
      );
    }
  }

  message.push('--foo_bar_baz--');

  // Encode the message
  const encodedMessage = Buffer.from(message.join(''))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const response = await gmailClient.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return {
      success: true,
      messageId: response.data.id,
      threadId: response.data.threadId,
    };
  } catch (error) {
    console.error('Error sending email via Gmail:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};
