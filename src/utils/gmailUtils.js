import { google } from 'googleapis';
import GmailIntegration from '../models/GmailIntegration.js';
import computeExpiry from './computeExpiry.js';

/**
 * Fetches detailed content of an email thread from Gmail
 * @param {string} workspaceId - The workspace ID
 * @param {string} emailId - The Gmail email ID
 * @returns {Promise<Object>} - The email thread details
 */
export async function fetchEmailThread(workspaceId, emailId) {
  try {
    console.log(`🔍 Attempting to fetch email ${emailId} for workspace ${workspaceId}`);

    // Find Gmail integration for this workspace
    const gmailIntegration = await GmailIntegration.findOne({
      workspace: workspaceId,
      isActive: true,
    });

    if (!gmailIntegration) {
      console.error(`❌ Gmail not connected for workspace ${workspaceId}`);
      throw new Error('Gmail not connected for this workspace');
    }

    console.log(`✓ Found Gmail integration for ${gmailIntegration.email}`);

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('❌ Missing Google API credentials in environment variables');
      throw new Error('Google API credentials not configured');
    }

    // Set credentials
    oauth2Client.setCredentials({
      access_token: gmailIntegration.accessToken,
      refresh_token: gmailIntegration.refreshToken,
      expiry_date: gmailIntegration.tokenExpiry.getTime(),
    });

    console.log(`✓ OAuth client configured with token expiring at ${gmailIntegration.tokenExpiry}`);
    console.log(`✓ Token expired? ${new Date() > gmailIntegration.tokenExpiry ? 'Yes' : 'No'}`);

    // Set up token refresh handler
    oauth2Client.on('tokens', async (tokens) => {
      console.log(
        '🔄 Token refresh triggered',
        tokens.expiry_date ? new Date(tokens.expiry_date) : 'no expiry',
      );
      if (tokens.refresh_token) {
        gmailIntegration.refreshToken = tokens.refresh_token;
      }
      gmailIntegration.accessToken = tokens.accessToken || tokens.access_token;
      if (tokens.expiry_date || tokens.expires_in) {
        gmailIntegration.tokenExpiry = computeExpiry(tokens);
      }
      gmailIntegration.refreshTokenLastUsedAt = new Date();
      await gmailIntegration.save();
      console.log('💾 Updated tokens saved to database');
    });

    try {
      // Create Gmail client
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      console.log('✓ Gmail client created');

      // Test the connection with a simple profile request
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log(`✓ Gmail connection working - connected as ${profile.data.emailAddress}`);

      // Get the full message
      console.log(`🔍 Fetching message: ${emailId}`);
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: emailId,
        format: 'full',
      });
      console.log(
        `✓ Retrieved message with id: ${message.data.id}, threadId: ${message.data.threadId}`,
      );

      // Extract email body
      let body = '';
      let bodyText = '';

      console.log(
        `✓ Message payload structure:`,
        JSON.stringify({
          mimeType: message.data.payload.mimeType,
          hasParts: !!message.data.payload.parts,
          hasBody: !!message.data.payload.body,
          bodySize: message.data.payload.body?.size || 0,
          hasData: !!message.data.payload.body?.data,
        }),
      );

      // Handle messages with parts (multipart messages)
      if (message.data.payload.parts && message.data.payload.parts.length > 0) {
        console.log(`✓ Message has ${message.data.payload.parts.length} parts`);

        // Debug log for parts structure
        const partsInfo = message.data.payload.parts.map((part) => ({
          mimeType: part.mimeType,
          filename: part.filename,
          partId: part.partId,
          bodySize: part.body?.size || 0,
          hasData: !!part.body?.data,
          nestedParts: part.parts ? part.parts.length : 0,
        }));

        console.log(`✓ Parts info:`, JSON.stringify(partsInfo));

        // First, try to find HTML and plain text parts at the top level
        for (const part of message.data.payload.parts) {
          if (part.mimeType === 'text/html' && part.body && part.body.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            console.log('✓ Found HTML body in top-level part');
          } else if (part.mimeType === 'text/plain' && part.body && part.body.data) {
            bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
            console.log('✓ Found plain text body in top-level part');
          }

          // Check for nested parts (common in multipart/alternative)
          if (part.parts && part.parts.length > 0) {
            console.log(`✓ Part ${part.partId} has ${part.parts.length} nested parts`);
            for (const nestedPart of part.parts) {
              if (nestedPart.mimeType === 'text/html' && nestedPart.body && nestedPart.body.data) {
                if (!body) {
                  // Only replace if we don't already have HTML
                  body = Buffer.from(nestedPart.body.data, 'base64').toString('utf-8');
                  console.log('✓ Found HTML body in nested part');
                }
              } else if (
                nestedPart.mimeType === 'text/plain' &&
                nestedPart.body &&
                nestedPart.body.data
              ) {
                if (!bodyText) {
                  // Only replace if we don't already have plain text
                  bodyText = Buffer.from(nestedPart.body.data, 'base64').toString('utf-8');
                  console.log('✓ Found plain text body in nested part');
                }
              }
            }
          }
        }

        // If parts exist but no body was found, try to extract from the main body
        if (!body && !bodyText && message.data.payload.body && message.data.payload.body.data) {
          console.log('⚠️ No body found in parts, checking main payload body');
          if (message.data.payload.mimeType.includes('html')) {
            body = Buffer.from(message.data.payload.body.data, 'base64').toString('utf-8');
          } else {
            bodyText = Buffer.from(message.data.payload.body.data, 'base64').toString('utf-8');
          }
        }
      } else if (message.data.payload.body && message.data.payload.body.data) {
        // Single part message
        console.log('✓ Message is single part');
        if (message.data.payload.mimeType.includes('html')) {
          body = Buffer.from(message.data.payload.body.data, 'base64').toString('utf-8');
          console.log('✓ Found HTML body in payload');
        } else {
          bodyText = Buffer.from(message.data.payload.body.data, 'base64').toString('utf-8');
          console.log('✓ Found plain text body in payload');
        }
      } else {
        console.log('⚠️ No parts or body data found in message');
      }

      // If no HTML body, use text body
      if (!body && bodyText) {
        body = bodyText;
        console.log('✓ Using plain text as body (no HTML found)');
      }

      // If no body was found, try to use the snippet
      if (!body && !bodyText && message.data.snippet) {
        body = `(Email body unavailable - preview: ${message.data.snippet})`;
        console.log('⚠️ Using snippet as fallback body');
      }

      console.log(
        `✓ Body extraction results: HTML: ${
          body ? body.substring(0, 50) + '...' : 'none'
        }, Plain: ${bodyText ? bodyText.substring(0, 50) + '...' : 'none'}`,
      );

      // Get the thread messages if this is part of a thread
      let threadMessages = [];
      if (message.data.threadId) {
        console.log(`🔍 Fetching thread: ${message.data.threadId}`);
        try {
          const thread = await gmail.users.threads.get({
            userId: 'me',
            id: message.data.threadId,
          });

          console.log(`✓ Thread retrieved with ${thread.data.messages?.length || 0} messages`);

          // Process each message in the thread
          threadMessages = thread.data.messages.map((msg) => {
            const msgHeaders = msg.payload.headers;
            const getMessageHeader = (name) => {
              const header = msgHeaders.find((h) => h.name.toLowerCase() === name.toLowerCase());
              return header ? header.value : null;
            };

            // Extract message body
            let msgBody = '';
            let msgBodyText = '';

            // Debug the message structure
            console.log(
              `✓ Thread message structure (ID: ${msg.id}):`,
              JSON.stringify({
                mimeType: msg.payload.mimeType,
                hasParts: !!msg.payload.parts,
                partsCount: msg.payload.parts ? msg.payload.parts.length : 0,
                hasBody: !!msg.payload.body,
                bodySize: msg.payload.body?.size || 0,
                hasData: !!msg.payload.body?.data,
              }),
            );

            // Handle messages with parts (multipart messages)
            if (msg.payload.parts && msg.payload.parts.length > 0) {
              // First, try to find HTML and plain text parts at the top level
              for (const part of msg.payload.parts) {
                if (part.mimeType === 'text/html' && part.body && part.body.data) {
                  msgBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
                } else if (part.mimeType === 'text/plain' && part.body && part.body.data) {
                  msgBodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
                }

                // Check for nested parts (common in multipart/alternative)
                if (part.parts && part.parts.length > 0) {
                  for (const nestedPart of part.parts) {
                    if (
                      nestedPart.mimeType === 'text/html' &&
                      nestedPart.body &&
                      nestedPart.body.data
                    ) {
                      if (!msgBody) {
                        // Only replace if we don't already have HTML
                        msgBody = Buffer.from(nestedPart.body.data, 'base64').toString('utf-8');
                      }
                    } else if (
                      nestedPart.mimeType === 'text/plain' &&
                      nestedPart.body &&
                      nestedPart.body.data
                    ) {
                      if (!msgBodyText) {
                        // Only replace if we don't already have plain text
                        msgBodyText = Buffer.from(nestedPart.body.data, 'base64').toString('utf-8');
                      }
                    }
                  }
                }
              }

              // If parts exist but no body was found, try to extract from the main body
              if (!msgBody && !msgBodyText && msg.payload.body && msg.payload.body.data) {
                if (msg.payload.mimeType.includes('html')) {
                  msgBody = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
                } else {
                  msgBodyText = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
                }
              }
            } else if (msg.payload.body && msg.payload.body.data) {
              // Single part message
              if (msg.payload.mimeType.includes('html')) {
                msgBody = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
              } else {
                msgBodyText = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
              }
            }

            // If no HTML body, use text body
            if (!msgBody && msgBodyText) {
              msgBody = msgBodyText;
            }

            // If no body was found at all, use the snippet
            if (!msgBody && !msgBodyText && msg.snippet) {
              msgBody = `(Email body unavailable - preview: ${msg.snippet})`;
            }

            // Record if we found the message body for debugging
            console.log(
              `✓ Thread message ${msg.id} body extraction: ${msgBody ? 'succeeded' : 'failed'}`,
            );

            return {
              id: msg.id,
              threadId: msg.threadId,
              from: getMessageHeader('From'),
              to: getMessageHeader('To'),
              subject: getMessageHeader('Subject'),
              date: getMessageHeader('Date'),
              body: msgBody || msgBodyText || '',
              snippet: msg.snippet,
            };
          });
        } catch (threadError) {
          console.error(`❌ Error fetching thread ${message.data.threadId}:`, threadError);
          // Continue with single message if thread fetch fails
          console.log('⚠️ Continuing with single message because thread fetch failed');
        }
      }

      console.log(
        `✅ Successfully processed email ${emailId} with ${threadMessages.length} related messages`,
      );

      // Return the email and thread details
      return {
        email: {
          id: message.data.id,
          threadId: message.data.threadId,
          from: message.data.payload.headers.find((h) => h.name.toLowerCase() === 'from')?.value,
          to: message.data.payload.headers.find((h) => h.name.toLowerCase() === 'to')?.value,
          subject: message.data.payload.headers.find((h) => h.name.toLowerCase() === 'subject')
            ?.value,
          date: message.data.payload.headers.find((h) => h.name.toLowerCase() === 'date')?.value,
          body,
          snippet: message.data.snippet,
        },
        thread: threadMessages,
      };
    } catch (apiError) {
      console.error('❌ Gmail API error:', apiError);

      // More detailed error handling
      if (apiError.code === 401 || apiError.message?.includes('invalid_grant')) {
        console.error('🔑 Authorization error - token may be expired or invalid');

        // Update integration status
        try {
          gmailIntegration.isActive = false;
          await gmailIntegration.save();
          console.log('⚠️ Gmail integration marked as inactive due to auth error');
        } catch (updateError) {
          console.error('Failed to update integration status:', updateError);
        }

        throw new Error('Gmail authorization failed. Please reconnect your Gmail account.');
      }

      if (apiError.code === 404 || apiError.message?.includes('not found')) {
        console.error(`📭 Email with ID ${emailId} not found`);
        throw new Error(`Email not found with ID: ${emailId}`);
      }

      throw apiError;
    }
  } catch (error) {
    console.error('❌ Error fetching Gmail thread:', error);
    throw error;
  }
}

/**
 * Prepares email context for AI processing
 * @param {Array} emails - Array of email metadata objects
 * @param {string} workspaceId - The workspace ID
 * @param {Object} options - Options for context preparation
 * @param {boolean} options.allowMockData - Whether to use mock data for testing if fetching fails
 * @returns {Promise<string>} - Formatted email context
 */
export async function prepareEmailContext(emails, workspaceId, options = {}) {
  const { allowMockData = false } = options;

  console.log(
    '📩 prepareEmailContext called with:',
    JSON.stringify({
      emailsCount: emails?.length || 0,
      emailsType: typeof emails,
      emailsIsArray: Array.isArray(emails),
      workspaceId,
      allowMockData,
    }),
  );

  if (!emails || !emails.length || !workspaceId) {
    console.log('❌ Email context skipped: Missing emails or workspace ID');
    return '';
  }

  try {
    // First check if Gmail integration is valid
    const integrationStatus = await checkGmailIntegration(workspaceId);
    if (integrationStatus.status !== 'success') {
      console.error('❌ Gmail integration invalid:', integrationStatus.message);

      // If mock data is allowed, create context from available metadata
      if (allowMockData) {
        console.log('⚠️ Using mock data for email context');
        return createMockEmailContext(emails);
      }

      return `\n--- EMAIL CONTEXT ERROR: ${integrationStatus.message} ---\n`;
    }

    // console.log(
    //   '📧 Processing emails:',
    //   emails.map((e) => ({ id: e.id, subject: e.subject })),
    // );
    let emailContext = '\n--- EMAIL CONTEXT START ---\n';
    let successCount = 0;
    let failureCount = 0;

    for (const emailMeta of emails) {
      try {
        console.log(`📨 Fetching email thread for: ${emailMeta.id}, subject: ${emailMeta.subject}`);
        // Fetch the full email thread using the email ID
        const threadData = await fetchEmailThread(workspaceId, emailMeta.id);
        console.log(`📝 Thread data fetched: ${threadData.thread?.length || 0} messages`);
        successCount++;

        // Format the email thread for context
        emailContext += `Email Subject: ${threadData.email.subject}\n`;
        emailContext += `From: ${threadData.email.from}\n`;
        emailContext += `Date: ${threadData.email.date}\n\n`;

        // Add full thread context if available
        if (threadData.thread && threadData.thread.length > 0) {
          emailContext += 'Thread:\n';

          // Sort thread by date
          const sortedThread = [...threadData.thread].sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
          });

          // Add each message in the thread
          for (const message of sortedThread) {
            emailContext += `--- ${message.date} - ${message.from} wrote: ---\n`;

            // Extract plain text from HTML if needed
            let plainText = message.body;
            if (message.body.includes('<')) {
              // Very basic HTML to text conversion
              plainText = message.body
                .replace(/<div[^>]*>/gi, '\n')
                .replace(/<p[^>]*>/gi, '\n')
                .replace(/<br[^>]*>/gi, '\n')
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/\n{3,}/g, '\n\n');
            }

            emailContext += `${plainText.trim()}\n\n`;
          }
        } else {
          // Just include the current email content
          emailContext += `Content:\n${threadData.email.body.replace(/<[^>]*>/g, '')}\n\n`;
        }

        emailContext += '---\n\n';
      } catch (error) {
        failureCount++;
        console.error(`❌ Error processing email ${emailMeta.id}:`, error);

        // Add basic information we know about the email
        emailContext += `Failed to fetch complete details for email: ${
          emailMeta.subject || 'Unknown subject'
        }\n`;
        if (emailMeta.snippet) {
          emailContext += `Snippet: ${emailMeta.snippet}\n`;
        }
        if (emailMeta.sender) {
          emailContext += `From: ${emailMeta.sender}\n`;
        }
        if (emailMeta.date) {
          emailContext += `Date: ${emailMeta.date}\n`;
        }
        emailContext += '---\n\n';
      }
    }

    emailContext += '--- EMAIL CONTEXT END ---\n';
    console.log(
      `✅ Email context generated with ${emails.length} emails (${emailContext.length} chars)`,
    );
    console.log(`📊 Success: ${successCount}, Failure: ${failureCount}`);
    return emailContext;
  } catch (error) {
    console.error('❌ Error preparing email context:', error);

    // If mock data is allowed, create context from available metadata
    if (allowMockData) {
      console.log('⚠️ Using mock data for email context after error');
      return createMockEmailContext(emails);
    }

    return '\n--- EMAIL CONTEXT ERROR: Failed to process emails ---\n';
  }
}

/**
 * Creates a mock context from email metadata when actual fetching fails
 * @param {Array} emails - Array of email metadata
 * @returns {string} - Formatted mock email context
 */
function createMockEmailContext(emails) {
  let mockContext = '\n--- EMAIL CONTEXT (LIMITED METADATA) START ---\n';

  for (const email of emails) {
    mockContext += `Email Subject: ${email.subject || 'Unknown subject'}\n`;

    if (email.sender) {
      mockContext += `From: ${email.sender}\n`;
    }

    if (email.date) {
      mockContext += `Date: ${email.date}\n`;
    }

    if (email.snippet) {
      mockContext += `\nPreview: ${email.snippet}\n`;
    }

    mockContext += '---\n\n';
  }

  mockContext += '--- EMAIL CONTEXT (LIMITED METADATA) END ---\n';
  return mockContext;
}

/**
 * Checks if the Gmail integration is working properly
 * @param {string} workspaceId - The workspace ID
 * @returns {Promise<Object>} - Status information about the Gmail integration
 */
export async function checkGmailIntegration(workspaceId) {
  try {
    console.log(`🔍 Checking Gmail integration for workspace ${workspaceId}`);

    // Find Gmail integration for this workspace
    const gmailIntegration = await GmailIntegration.findOne({
      workspace: workspaceId,
      isActive: true,
    });

    if (!gmailIntegration) {
      console.error(`❌ Gmail not connected for workspace ${workspaceId}`);
      return {
        status: 'error',
        connected: false,
        message: 'Gmail not connected for this workspace',
        details: {
          integration: null,
        },
      };
    }

    console.log(`✓ Found Gmail integration for ${gmailIntegration.email}`);

    // Check Google API credentials
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('❌ Missing Google API credentials in environment variables');
      return {
        status: 'error',
        connected: false,
        message: 'Google API credentials not configured',
        details: {
          integration: {
            email: gmailIntegration.email,
            isActive: gmailIntegration.isActive,
            tokenExpiry: gmailIntegration.tokenExpiry,
          },
        },
      };
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
      expiry_date: gmailIntegration.tokenExpiry.getTime(),
    });

    const isTokenExpired = new Date() > gmailIntegration.tokenExpiry;
    console.log(`✓ OAuth client configured with token expiring at ${gmailIntegration.tokenExpiry}`);
    console.log(`✓ Token expired? ${isTokenExpired ? 'Yes' : 'No'}`);

    // Set up token refresh handler
    oauth2Client.on('tokens', async (tokens) => {
      console.log(
        '🔄 Token refresh triggered',
        tokens.expiry_date ? new Date(tokens.expiry_date) : 'no expiry',
      );
      if (tokens.refresh_token) {
        gmailIntegration.refreshToken = tokens.refresh_token;
      }

      gmailIntegration.accessToken = tokens.accessToken || tokens.access_token;
      if (tokens.expiry_date || tokens.expires_in) {
        gmailIntegration.tokenExpiry = computeExpiry(tokens);
      }
      gmailIntegration.refreshTokenLastUsedAt = new Date();
      await gmailIntegration.save();
      console.log('💾 Updated tokens saved to database');
    });

    try {
      // Create Gmail client
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Test the connection with a profile request
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log(`✅ Gmail connection successful as ${profile.data.emailAddress}`);

      return {
        status: 'success',
        connected: true,
        message: 'Gmail integration is working properly',
        details: {
          integration: {
            email: gmailIntegration.email,
            isActive: gmailIntegration.isActive,
            tokenExpiry: gmailIntegration.tokenExpiry,
            tokenExpired: isTokenExpired,
          },
          profile: {
            email: profile.data.emailAddress,
            messagesTotal: profile.data.messagesTotal,
            threadsTotal: profile.data.threadsTotal,
            historyId: profile.data.historyId,
          },
        },
      };
    } catch (apiError) {
      console.error('❌ Gmail API error:', apiError);

      let errorDetails = {
        code: apiError.code,
        message: apiError.message,
        response: apiError.response?.data,
      };

      // Check for auth errors
      if (apiError.code === 401 || apiError.message?.includes('invalid_grant')) {
        console.error('🔑 Authorization error - token may be expired or invalid');

        // Update integration status
        try {
          gmailIntegration.isActive = false;
          await gmailIntegration.save();
          console.log('⚠️ Gmail integration marked as inactive due to auth error');
        } catch (updateError) {
          console.error('Failed to update integration status:', updateError);
        }

        return {
          status: 'error',
          connected: false,
          message: 'Gmail authorization failed. Please reconnect your Gmail account.',
          details: {
            integration: {
              email: gmailIntegration.email,
              isActive: false,
              tokenExpiry: gmailIntegration.tokenExpiry,
              tokenExpired: isTokenExpired,
            },
            error: errorDetails,
          },
        };
      }

      return {
        status: 'error',
        connected: false,
        message: `Gmail API error: ${apiError.message}`,
        details: {
          integration: {
            email: gmailIntegration.email,
            isActive: gmailIntegration.isActive,
            tokenExpiry: gmailIntegration.tokenExpiry,
            tokenExpired: isTokenExpired,
          },
          error: errorDetails,
        },
      };
    }
  } catch (error) {
    console.error('❌ Error checking Gmail integration:', error);
    return {
      status: 'error',
      connected: false,
      message: `Error checking Gmail integration: ${error.message}`,
      details: {
        error: {
          message: error.message,
          stack: error.stack,
        },
      },
    };
  }
}
