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
export const sendGmailEmail = async (gmailClient, emailData, integration) => {
  const { to, cc, bcc, subject, html, attachments = [], inReplyTo, references } = emailData;

  // Convert string recipients to arrays if needed
  const toArray = typeof to === 'string' ? to.split(',').map((email) => email.trim()) : to;
  const ccArray = cc
    ? typeof cc === 'string'
      ? cc.split(',').map((email) => email.trim())
      : cc
    : [];
  const bccArray = bcc
    ? typeof bcc === 'string'
      ? bcc.split(',').map((email) => email.trim())
      : bcc
    : [];

  // Validate basic email fields
  if (!toArray || !Array.isArray(toArray) || toArray.length === 0) {
    throw new Error('recipient (to) is required');
  }

  if (!subject) {
    throw new Error('subject is required');
  }

  if (!html) {
    throw new Error('email body (html) is required');
  }

  // Format subject for replies (remove Re: if it's already there)
  const formattedSubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

  // Encode subject using UTF-8
  const encodedSubject = Buffer.from(formattedSubject).toString('base64');
  const subjectHeader = `=?UTF-8?B?${encodedSubject}?=`;

  // Generate a unique message ID
  const messageId = `<${Math.random().toString(36).substring(2)}@${
    integration.email.split('@')[1]
  }>`;

  // Format references array - ensure inReplyTo is first in the chain
  const formattedReferences = [];

  // If this is a reply, ensure we have valid inReplyTo and references
  if (inReplyTo) {
    // Clean up the inReplyTo value (remove < > if present)
    const cleanInReplyTo = inReplyTo.replace(/[<>]/g, '');
    formattedReferences.push(`<${cleanInReplyTo}>`);

    // Add remaining references if they exist
    if (references && Array.isArray(references)) {
      references.forEach((ref) => {
        const cleanRef = ref.replace(/[<>]/g, '');
        if (cleanRef !== cleanInReplyTo) {
          formattedReferences.push(`<${cleanRef}>`);
        }
      });
    }
  }

  // Create email message parts
  const messageParts = [
    'Content-Type: multipart/mixed; boundary="foo_bar_baz"\r\n',
    'MIME-Version: 1.0\r\n',
    `From: ${integration.email}\r\n`,
    `To: ${toArray.join(', ')}\r\n`,
    ccArray.length ? `Cc: ${ccArray.join(', ')}\r\n` : '',
    bccArray.length ? `Bcc: ${bccArray.join(', ')}\r\n` : '',
    `Subject: ${subjectHeader}\r\n`,
    inReplyTo ? `In-Reply-To: <${inReplyTo.replace(/[<>]/g, '')}>\r\n` : '',
    formattedReferences.length ? `References: ${formattedReferences.join(' ')}\r\n` : '',
    `Message-ID: ${messageId}\r\n`,
    'Date: ' + new Date().toUTCString() + '\r\n',
    'Thread-Index: ' + Buffer.from(Date.now().toString()).toString('base64') + '\r\n',
    '\r\n',
    '--foo_bar_baz\r\n',
    'Content-Type: multipart/alternative; boundary="foo_bar_baz_alt"\r\n\r\n',
    '--foo_bar_baz_alt\r\n',
    'Content-Type: text/html; charset="UTF-8"\r\n\r\n',
    html,
    '\r\n\r\n',
    '--foo_bar_baz_alt--\r\n\r\n',
  ];

  // Add attachments if any
  if (attachments.length > 0) {
    for (const attachment of attachments) {
      if (!attachment.mimeType || !attachment.filename || !attachment.content) {
        throw new Error('Invalid attachment format: missing required fields');
      }
      messageParts.push(
        '--foo_bar_baz\r\n',
        `Content-Type: ${attachment.mimeType}\r\n`,
        'Content-Transfer-Encoding: base64\r\n',
        `Content-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n`,
        attachment.content.toString('base64'),
        '\r\n\r\n',
      );
    }
  }

  // Add final boundary
  messageParts.push('--foo_bar_baz--');

  // Join all parts and encode the message
  const message = messageParts.join('');
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    // First, get the thread ID for the message we're replying to
    let threadId;
    if (inReplyTo) {
      try {
        const messageResponse = await gmailClient.users.messages.get({
          userId: 'me',
          id: inReplyTo.replace(/[<>]/g, ''),
        });
        threadId = messageResponse.data.threadId;
      } catch (error) {
        console.warn('Could not find thread ID for message, sending as new thread');
      }
    }

    const response = await gmailClient.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        threadId: threadId, // Use the thread ID from the original message
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
