import { google } from 'googleapis';
import Email from '../models/Email.js';
import GmailIntegration from '../models/GmailIntegration.js';

class EmailStreamService {
  constructor() {
    this.activeStreams = new Map(); // Map of workspaceId -> stream
    this.historyIds = new Map(); // Track last history ID per email
  }

  /**
   * Start email streaming for all workspaces with active Gmail integrations
   */
  async start() {
    try {
      // Find all active Gmail integrations
      const integrations = await GmailIntegration.find({ isActive: true }).populate(
        'workspace',
        'name',
      );

      // Set up streams for each integration
      for (const integration of integrations) {
        await this.setupStreamForIntegration(integration);
      }
    } catch (error) {
      console.error('Error starting email stream service:', error);
    }
  }

  /**
   * Set up stream for a specific Gmail integration
   */
  async setupStreamForIntegration(integration) {
    try {
      const workspaceId = integration.workspace._id.toString();
      const email = integration.email;

      // If there's already a stream for this workspace, don't add another one
      if (this.activeStreams.has(`${workspaceId}-${email}`)) {
        return;
      }

      // Create OAuth client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI,
      );

      // Set credentials
      oauth2Client.setCredentials({
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken,
        expiry_date: integration.tokenExpiry.getTime(),
      });

      // Create Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Get initial history ID
      const profile = await gmail.users.getProfile({ userId: 'me' });
      const historyId = profile.data.historyId;
      this.historyIds.set(`${workspaceId}-${email}`, historyId);

      // Set up watch request for push notifications
      await gmail.users.watch({
        userId: 'me',
        requestBody: {
          labelIds: ['INBOX'],
          topicName: `projects/${process.env.GOOGLE_PROJECT_ID}/topics/${process.env.GOOGLE_PUBSUB_TOPIC}`,
        },
      });

      // Store stream info
      this.activeStreams.set(`${workspaceId}-${email}`, {
        gmail,
        integration,
        oauth2Client,
      });

      return true;
    } catch (error) {
      console.error('Error setting up email stream:', error);
      return false;
    }
  }

  /**
   * Process incoming email notifications
   */
  async processEmailNotification(notification) {
    try {
      const { emailAddress, historyId } = notification;

      // Find the integration for this email
      const integration = await GmailIntegration.findOne({
        email: emailAddress,
        isActive: true,
      }).populate('workspace');

      if (!integration) {
        return;
      }

      const workspaceId = integration.workspace._id.toString();
      const streamInfo = this.activeStreams.get(`${workspaceId}-${emailAddress}`);

      if (!streamInfo) {
        return;
      }

      const { gmail } = streamInfo;
      const lastHistoryId = this.historyIds.get(`${workspaceId}-${emailAddress}`);

      // Get history since last check
      const history = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: lastHistoryId,
        historyTypes: ['messageAdded'],
      });

      // Update history ID
      if (history.data.historyId) {
        this.historyIds.set(`${workspaceId}-${emailAddress}`, history.data.historyId);
      }

      // Process new messages
      if (history.data.history && history.data.history.length > 0) {
        for (const record of history.data.history) {
          if (record.messagesAdded) {
            for (const messageAdded of record.messagesAdded) {
              await this.processEmail(gmail, integration, messageAdded.message.id);
            }
          }
        }
      }

      // Update last synced timestamp
      integration.lastSynced = new Date();
      await integration.save();
    } catch (error) {
      console.error('Error processing email notification:', error);
    }
  }

  /**
   * Process a specific email message
   */
  async processEmail(gmail, integration, messageId) {
    try {
      // Get the full message
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      // Extract headers
      const headers = message.data.payload.headers;
      const getHeader = (name) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      // Extract email details
      const from = getHeader('From');
      const to = getHeader('To')
        .split(',')
        .map((email) => email.trim());
      const cc = getHeader('Cc')
        ? getHeader('Cc')
            .split(',')
            .map((email) => email.trim())
        : [];
      const bcc = getHeader('Bcc')
        ? getHeader('Bcc')
            .split(',')
            .map((email) => email.trim())
        : [];
      const subject = getHeader('Subject');
      const threadId = message.data.threadId;
      const sentAt = new Date(getHeader('Date'));

      // Get message body
      const body = this.extractMessageBody(message.data.payload);

      // Create email document
      const email = new Email({
        workspace: integration.workspace._id,
        subject,
        body,
        bodyText: body.replace(/<[^>]*>/g, ''), // Strip HTML tags for plain text version
        to,
        cc,
        bcc,
        from,
        threadId,
        direction: 'inbound',
        status: 'received',
        sentAt,
      });

      await email.save();
    } catch (error) {
      console.error('Error processing email:', error);
    }
  }

  /**
   * Extract message body from Gmail message payload
   */
  extractMessageBody(payload) {
    if (payload.parts) {
      // Find HTML part
      const htmlPart = payload.parts.find((part) => part.mimeType === 'text/html');
      if (htmlPart && htmlPart.body.data) {
        return Buffer.from(htmlPart.body.data, 'base64').toString();
      }

      // Fallback to plain text
      const textPart = payload.parts.find((part) => part.mimeType === 'text/plain');
      if (textPart && textPart.body.data) {
        return Buffer.from(textPart.body.data, 'base64').toString();
      }
    }

    // Handle single part messages
    if (payload.body.data) {
      return Buffer.from(payload.body.data, 'base64').toString();
    }

    return '';
  }

  /**
   * Stop all email streams
   */
  async stop() {
    for (const [key, streamInfo] of this.activeStreams.entries()) {
      try {
        const { gmail, integration } = streamInfo;
        await gmail.users.stop({ userId: 'me' });
      } catch (error) {
        console.error('Error stopping email stream:', error);
      }
    }

    this.activeStreams.clear();
    this.historyIds.clear();
  }

  /**
   * Add a new Gmail integration to the stream service
   */
  async addIntegration(integration) {
    return await this.setupStreamForIntegration(integration);
  }

  /**
   * Remove a Gmail integration from the stream service
   */
  async removeIntegration(workspaceId, email) {
    const key = `${workspaceId}-${email}`;

    if (this.activeStreams.has(key)) {
      const streamInfo = this.activeStreams.get(key);
      try {
        await streamInfo.gmail.users.stop({ userId: 'me' });
      } catch (error) {
        console.error('Error stopping email stream:', error);
      }
      this.activeStreams.delete(key);
      this.historyIds.delete(key);
      return true;
    }

    return false;
  }
}

// Create and export a singleton instance
const emailStreamService = new EmailStreamService();
export default emailStreamService;
