import createDOMPurify from 'dompurify';
import { google } from 'googleapis';
import { JSDOM } from 'jsdom';
import Email from '../models/Email.js';
import GmailIntegration from '../models/GmailIntegration.js';
import { fileUtils, firebaseStorage } from '../utils/firebase.js';

// Initialize DOMPurify
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Constants
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20MB

// MIME type to extension mapping
const MIME_EXTENSION_MAP = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/json': 'json',
  'text/html': 'html',
  'text/xml': 'xml',
  'application/xml': 'xml',
};

class GmailListenerService {
  constructor() {
    this.activeListeners = new Map(); // Map of workspaceId -> polling interval
    this.pollingInterval = 60000; // 1 minute by default
    this.historyIds = new Map(); // Track last history ID per email to avoid reprocessing
  }

  /**
   * Sanitize HTML content
   */
  sanitizeHtml(html) {
    try {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'img', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title'],
        ALLOW_DATA_ATTR: false,
      });
    } catch (error) {
      console.error('HTML sanitization failed:', error);
      return html; // Return original if sanitization fails
    }
  }

  /**
   * Start Gmail listener for all workspaces with active Gmail integrations
   */
  async start() {
    try {
      // Find all active Gmail integrations
      const integrations = await GmailIntegration.find({ isActive: true }).populate(
        'workspace',
        'name',
      );

      // Set up listeners for each integration
      for (const integration of integrations) {
        await this.setupListenerForIntegration(integration);
      }
    } catch (error) {
      // Error starting Gmail listener service
    }
  }

  /**
   * Proactively refresh tokens if they're about to expire
   */
  async refreshTokensIfNeeded(oauth2Client, integration) {
    try {
      // Check if token is expired or about to expire (within 5 minutes)
      const isTokenExpired =
        integration.tokenExpiry &&
        Date.now() >= new Date(integration.tokenExpiry).getTime() - 5 * 60 * 1000;

      if (isTokenExpired) {
        const { tokens } = await oauth2Client.refreshToken(integration.refreshToken);

        // Update tokens in database
        integration.accessToken = tokens.access_token;
        if (tokens.refresh_token) integration.refreshToken = tokens.refresh_token;
        integration.tokenExpiry = new Date(tokens.expiry_date);
        await integration.save();

        // Update oauth client with new tokens
        oauth2Client.setCredentials({
          access_token: integration.accessToken,
          refresh_token: integration.refreshToken,
          expiry_date: integration.tokenExpiry.getTime(),
        });
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Set up listener for a specific Gmail integration
   */
  async setupListenerForIntegration(integration) {
    try {
      const workspaceId = integration.workspace._id.toString();
      const email = integration.email;

      // If there's already a listener for this workspace, don't add another one
      if (this.activeListeners.has(`${workspaceId}-${email}`)) {
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

      // Set up token refresh handler
      oauth2Client.on('tokens', async (tokens) => {
        if (tokens.refresh_token) {
          // Update refresh token in the database
          integration.refreshToken = tokens.refresh_token;
        }

        integration.accessToken = tokens.access_token;
        integration.tokenExpiry = new Date(tokens.expiry_date);
        await integration.save();
      });

      // Start polling interval
      const intervalId = setInterval(async () => {
        try {
          // Check and refresh tokens if needed before checking emails
          await this.refreshTokensIfNeeded(oauth2Client, integration);
          await this.checkNewEmails(oauth2Client, integration);
        } catch (error) {
          if (error.code === 401) {
            // Handle token refresh failure
            integration.isActive = false;
            await integration.save();
            clearInterval(intervalId);
            this.activeListeners.delete(`${workspaceId}-${email}`);
          }
        }
      }, this.pollingInterval);

      // Store interval ID for cleanup
      this.activeListeners.set(`${workspaceId}-${email}`, intervalId);

      // Do initial check
      await this.refreshTokensIfNeeded(oauth2Client, integration);
      await this.checkNewEmails(oauth2Client, integration);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check for new emails for a specific integration
   */
  async checkNewEmails(oauth2Client, integration) {
    try {
      // Create Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Get workspace and email info
      const workspaceId = integration.workspace._id;
      const email = integration.email;

      // Get last history ID for this integration
      let historyId = this.historyIds.get(`${workspaceId}-${email}`);

      if (!historyId) {
        // If no history ID, get the current one to use for next time
        const profile = await gmail.users.getProfile({ userId: 'me' });
        historyId = profile.data.historyId;
        this.historyIds.set(`${workspaceId}-${email}`, historyId);
        console.log(`Initialized historyId for ${email}: ${historyId}`);
        return; // Skip first run, just initialize the history ID
      }

      // List changes since last check
      const history = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: historyId,
        historyTypes: ['messageAdded'],
      });

      // Update history ID
      if (history.data.historyId) {
        this.historyIds.set(`${workspaceId}-${email}`, history.data.historyId);
      }

      // No changes
      if (!history.data.history || !history.data.history.length) {
        return;
      }

      // Process each history record
      for (const record of history.data.history) {
        if (record.messagesAdded) {
          for (const messageAdded of record.messagesAdded) {
            await this.processEmail(gmail, integration, messageAdded.message.id);
          }
        }
      }

      // Update last synced timestamp
      integration.lastSynced = new Date();
      await integration.save();
    } catch (error) {
      // If token expired or invalid, deactivate the integration
      if (error.code === 401) {
        integration.isActive = false;
        await integration.save();

        // Stop the listener
        const key = `${integration.workspace._id}-${integration.email}`;
        if (this.activeListeners.has(key)) {
          clearInterval(this.activeListeners.get(key));
          this.activeListeners.delete(key);
        }
      }
      throw error;
    }
  }

  /**
   * Process a specific email message
   */
  async processEmail(gmail, integration, messageId) {
    try {
      console.log('📧 Processing Gmail message:', {
        messageId,
        workspace: integration.workspace._id,
      });

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

      // Get message ID from headers
      const messageIdHeader = getHeader('Message-ID');

      // Check for existing email to prevent duplicates
      const existingEmail = await Email.findOne({
        $or: [{ gmailMessageId: messageId }, { messageId: messageIdHeader }],
        workspaceId: integration.workspace._id,
      });

      if (existingEmail) {
        console.log(`⏭️ Email ${messageId} already processed, skipping`);
        return;
      }

      // Process email body and attachments
      console.log('📝 Processing email parts and attachments');
      const {
        body,
        attachments = [],
        inlineImages = [],
      } = await this.processEmailParts(
        gmail,
        messageId,
        message.data.payload,
        integration.workspace._id.toString(),
      );

      // Extract and format email details
      const fromHeader = getHeader('From');
      const toHeader = getHeader('To');
      const ccHeader = getHeader('Cc');
      const bccHeader = getHeader('Bcc');
      const subject = getHeader('Subject');
      const threadId = message.data.threadId;
      const sentAt = new Date(getHeader('Date'));

      // Format email addresses
      const formatEmailAddress = (emailStr) => {
        if (!emailStr) return { name: '', email: '' };
        const match = emailStr.match(/(.*?)\s*<([^>]+)>/) || [null, null, emailStr];
        return {
          name: match[1]?.trim() || '',
          email: match[2]?.trim() || match[3]?.trim() || emailStr.trim(),
        };
      };

      const from = formatEmailAddress(fromHeader);
      const to = toHeader ? toHeader.split(',').map(formatEmailAddress) : [];
      const cc = ccHeader ? ccHeader.split(',').map(formatEmailAddress) : [];
      const bcc = bccHeader ? bccHeader.split(',').map(formatEmailAddress) : [];

      console.log('📨 Email details:', {
        from,
        to,
        subject,
        threadId,
        attachmentsCount: attachments.length,
        inlineImagesCount: inlineImages.length,
      });

      // Format attachments with required fields
      const formattedAttachments = attachments.map((att) => ({
        filename: att.filename || 'unnamed_file',
        size: att.size || 0,
        type: att.type || 'unknown',
        mimeType: att.mimeType || 'application/octet-stream',
        storageUrl: att.downloadUrl || '',
        attachmentId: att.attachmentId || messageId,
        isInline: att.isInline || false,
        error: att.error || null,
        skipped: att.skipped || false,
      }));

      // Format inline images
      const formattedInlineImages = inlineImages.map((img) => ({
        filename: img.filename || 'unnamed_image',
        size: img.size || 0,
        type: img.type || 'image',
        mimeType: img.mimeType || 'image/jpeg',
        storageUrl: img.downloadUrl || '',
        contentId: img.contentId || '',
      }));

      // Create email document
      const email = new Email({
        subject: subject || '(No Subject)',
        body: {
          html: body || '',
          text: body ? body.replace(/<[^>]*>/g, '') : '', // Strip HTML tags for plain text version
        },
        to,
        cc,
        bcc,
        from,
        gmailMessageId: messageId,
        messageId: messageIdHeader,
        threadId,
        attachments: formattedAttachments,
        inlineImages: formattedInlineImages,
        direction: 'inbound',
        status: 'received',
        sentAt,
        workspaceId: integration.workspace._id,
        // Gmail specific fields
        token: {
          id: messageId,
          type: 'gmail',
          accessToken: integration.accessToken,
          refreshToken: integration.refreshToken,
          scope: 'https://www.googleapis.com/auth/gmail.readonly',
          expiryDate: integration.tokenExpiry,
        },
        threadPart: parseInt(threadId, 16) || 0, // Convert hex to number
        historyId: message.data.historyId,
        internalDate: message.data.internalDate,
        snippet: message.data.snippet || '',
        userId: integration.workspace._id.toString(),
      });

      await email.save();
      console.log('✅ Gmail email processed successfully:', {
        emailId: email._id,
        workspaceId: email.workspaceId,
        attachmentsCount: formattedAttachments.length,
        inlineImagesCount: formattedInlineImages.length,
      });
    } catch (error) {
      // Handle 404 errors gracefully (email not found)
      if (error.code === 404) {
        console.log('⚠️ Email not found:', messageId);
        return;
      }
      console.error('❌ Error processing Gmail email:', error);
      throw error;
    }
  }

  /**
   * Process email parts including attachments
   */
  async processEmailParts(gmail, messageId, part, workspaceId, options = {}) {
    const result = {
      body: '',
      attachments: [],
      inlineImages: [],
      errors: [],
    };

    try {
      if (!part) {
        throw new Error('Invalid email part');
      }

      // Extract body content first
      result.body = this.extractFirstMatching(part);

      // Sanitize HTML content
      if (result.body) {
        result.body = this.sanitizeHtml(result.body);
      }

      // Handle multipart messages
      if (part.mimeType && part.mimeType.startsWith('multipart/')) {
        if (!part.parts || !Array.isArray(part.parts)) {
          throw new Error(`Invalid multipart structure: ${part.mimeType}`);
        }

        // Process each subpart
        for (const subpart of part.parts) {
          const subpartResult = await this.processEmailParts(
            gmail,
            messageId,
            subpart,
            workspaceId,
            options,
          );

          // Merge results
          result.attachments.push(...subpartResult.attachments);
          result.inlineImages.push(...subpartResult.inlineImages);
          result.errors.push(...subpartResult.errors);
        }

        return result;
      }

      // Handle single part messages
      const contentType = part.mimeType || 'text/plain';
      const contentId = part.headers?.find((h) => h.name.toLowerCase() === 'content-id')?.value;
      const contentDisposition =
        part.headers?.find((h) => h.name.toLowerCase() === 'content-disposition')?.value || '';
      const isAttachment = contentDisposition.toLowerCase().includes('attachment');
      const isInline = contentDisposition.toLowerCase().includes('inline');

      // Process attachments
      if (isAttachment || isInline) {
        try {
          const attachment = await this.processAttachment(gmail, messageId, part, workspaceId);

          if (attachment) {
            if (isInline && contentId) {
              result.inlineImages.push(attachment);
            } else {
              result.attachments.push(attachment);
            }
          }
        } catch (error) {
          result.errors.push({
            part: part.mimeType,
            error: `Attachment processing failed: ${error.message}`,
          });
        }
      }

      return result;
    } catch (error) {
      result.errors.push({
        part: part.mimeType,
        error: error.message,
      });
      return result;
    }
  }

  /**
   * Extract first matching content type from email parts
   */
  extractFirstMatching(part, types = ['text/html', 'text/plain']) {
    if (types.includes(part.mimeType) && part.body?.data) {
      return Buffer.from(part.body.data, 'base64url').toString();
    }
    if (part.parts?.length) {
      for (const sub of part.parts) {
        const res = this.extractFirstMatching(sub, types);
        if (res) return res;
      }
    }
    return '';
  }

  /**
   * Process a single attachment
   */
  async processAttachment(gmail, messageId, part, workspaceId) {
    try {
      // Get attachment data if not already present
      let attachmentData = part.body.data;
      if (!attachmentData && part.body.attachmentId) {
        const response = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: messageId,
          id: part.body.attachmentId,
        });
        attachmentData = response.data.data;
      }

      // Decode base64url data
      const decodedData = Buffer.from(attachmentData, 'base64url');

      // Check file size
      if (decodedData.length > MAX_ATTACHMENT_SIZE) {
        console.warn(`Attachment too large (${decodedData.length} bytes), skipping upload`);
        return {
          filename: this.extractFilename(part),
          mimeType: part.mimeType,
          size: decodedData.length,
          error: 'File too large',
          skipped: true,
        };
      }

      // Generate storage path
      const filename = this.extractFilename(part);
      const storagePath = firebaseStorage.generatePath(workspaceId, filename);

      // Upload to Firebase Storage
      const { url: downloadUrl, storagePath: finalStoragePath } = await firebaseStorage.uploadFile(
        decodedData,
        storagePath,
        part.mimeType,
      );

      return {
        filename,
        mimeType: part.mimeType,
        size: decodedData.length,
        attachmentId: part.body.attachmentId,
        storagePath: finalStoragePath,
        downloadUrl,
        type: fileUtils.getType(part.mimeType),
        isInline: part.headers?.some(
          (h) =>
            h.name.toLowerCase() === 'content-disposition' &&
            h.value.toLowerCase().includes('inline'),
        ),
      };
    } catch (error) {
      console.error('Error processing attachment:', error);
      throw error;
    }
  }

  /**
   * Extract filename from email part
   */
  extractFilename(part) {
    const contentDisposition =
      part.headers?.find((h) => h.name.toLowerCase() === 'content-disposition')?.value || '';

    const filenameMatch =
      contentDisposition.match(/filename="([^"]+)"/) ||
      contentDisposition.match(/filename=([^;]+)/);

    if (filenameMatch) {
      return filenameMatch[1].trim();
    }

    // Fallback to content type if no filename found
    const contentType = part.mimeType || '';
    const extension = MIME_EXTENSION_MAP[contentType] || 'bin';
    return `attachment.${extension}`;
  }

  /**
   * Get project ID for an email (custom business logic)
   * This method determines which project an email belongs to
   */
  async getProjectIdForEmail({ from, to, subject, threadId, workspace }) {
    try {
      // Strategy 1: Check for existing thread - this is the most reliable method
      // If this email is part of an existing thread, associate it with the same project
      if (threadId) {
        const existingEmail = await Email.findOne({
          threadId,
          workspace,
        }).sort({ sentAt: -1 }); // Get the most recent email with this threadId

        if (existingEmail && existingEmail.projectId) {
          return existingEmail.projectId;
        }
      }

      // Strategy 2: Check for project identifiers in the subject line
      // e.g., [Project: ABC-123] or #ProjectName or similar patterns
      if (subject) {
        // Example pattern: [Project: ABC-123] or [ABC-123]
        const projectTagMatch = subject.match(/\[Project:\s*([^\]]+)\]|\[([^\]]+)\]/);
        if (projectTagMatch) {
          const projectRef = projectTagMatch[1] || projectTagMatch[2];

          // Search for projects with this reference or name
          // This would need to be customized based on your Project schema
          /*
          const project = await Project.findOne({ 
            $or: [
              { projectNumber: projectRef },
              { name: { $regex: new RegExp(projectRef, 'i') } }
            ],
            workspace
          });
          
          if (project) {
            return project._id;
          }
          */
        }
      }

      // Strategy 3: Analyze sender/recipient
      // For example, if we know certain clients are associated with certain projects
      if (from) {
        const senderEmail = this.extractEmailAddress(from);

        // Look for participants in projects with this email
        /*
        const projectParticipant = await ProjectParticipant.findOne({
          email: senderEmail,
          workspace
        }).populate('project');
        
        if (projectParticipant && projectParticipant.project) {
          return projectParticipant.project._id;
        }
        */
      }

      // Strategy 4: Default to a workspace inbox or specific project for unassigned emails
      // This could be a setting in the workspace settings
      /*
      const workspaceSettings = await WorkspaceSettings.findOne({ workspace });
      if (workspaceSettings && workspaceSettings.defaultInboxProject) {
        return workspaceSettings.defaultInboxProject;
      }
      */

      // If no match found, return null (email won't be processed)
      // Alternatively, you could create an "Inbox" project for unassigned emails
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract email address from a formatted email string
   */
  extractEmailAddress(emailString) {
    if (!emailString) return null;

    const match = emailString.match(/<([^>]*)>/) || emailString.match(/([^\s<]+@[^\s>]+)/);
    return match ? match[1] : emailString;
  }

  /**
   * Extract display name from a formatted email string
   */
  extractDisplayName(emailString) {
    if (!emailString) return null;

    const match = emailString.match(/^"?([^"<]+)"?\s*<.+>$/);
    return match ? match[1].trim() : null;
  }

  /**
   * Stop all Gmail listeners
   */
  stop() {
    // Clear all intervals
    for (const intervalId of this.activeListeners.values()) {
      clearInterval(intervalId);
    }

    this.activeListeners.clear();
  }

  /**
   * Add a new Gmail integration to the listener service
   */
  async addIntegration(integration) {
    return await this.setupListenerForIntegration(integration);
  }

  /**
   * Remove a Gmail integration from the listener service
   */
  removeIntegration(workspaceId, email) {
    const key = `${workspaceId}-${email}`;

    if (this.activeListeners.has(key)) {
      clearInterval(this.activeListeners.get(key));
      this.activeListeners.delete(key);
      return true;
    }

    return false;
  }
}

// Create and export a singleton instance
const gmailListenerService = new GmailListenerService();
export default gmailListenerService;
