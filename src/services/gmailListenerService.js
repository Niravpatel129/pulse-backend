import { createHash } from 'crypto';
import createDOMPurify from 'dompurify';
import { google } from 'googleapis';
import sha256 from 'js-sha256';
import { JSDOM } from 'jsdom';
import mongoose from 'mongoose';
import Email from '../models/Email.js';
import EmailThread from '../models/Email/EmailThreadModel.js';
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

      // Check for existing email to prevent duplicates using atomic operation
      const existingEmail = await Email.findOneAndUpdate(
        {
          gmailMessageId: messageId,
          workspaceId: integration.workspace._id,
        },
        { $setOnInsert: { _id: new mongoose.Types.ObjectId() } },
        {
          new: false,
          upsert: false,
          setDefaultsOnInsert: false,
        },
      );

      if (existingEmail) {
        console.log('[Gmail] Duplicate email detected, attempting to add to thread:', {
          messageId,
          gmailMessageId: messageId,
          workspaceId: integration.workspace._id,
        });

        // Get the full message to process thread information
        const message = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        });

        // Extract headers for thread processing
        const headers = message.data.payload.headers;
        const getHeader = (name) =>
          headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        const threadId = message.data.threadId;
        const sentAt = new Date(getHeader('Date'));
        const fromHeader = getHeader('From');
        const toHeader = getHeader('To');
        const ccHeader = getHeader('Cc');
        const bccHeader = getHeader('Bcc');
        const subject = getHeader('Subject');
        const messageIdHeader = getHeader('Message-ID');

        // Format email addresses
        const from = this.formatEmailAddress(fromHeader, 'from');
        const to = toHeader
          ? toHeader.split(',').map((addr) => this.formatEmailAddress(addr, 'to'))
          : [];
        const cc = ccHeader
          ? ccHeader.split(',').map((addr) => this.formatEmailAddress(addr, 'cc'))
          : [];
        const bcc = bccHeader
          ? bccHeader.split(',').map((addr) => this.formatEmailAddress(addr, 'bcc'))
          : [];

        // Update thread with the existing email
        const thread = await EmailThread.findOneAndUpdate(
          { threadId },
          {
            $setOnInsert: {
              workspaceId: integration.workspace._id,
              title: this.generateThreadTitle(subject, from),
              subject: subject || '(No Subject)',
              cleanSubject: this.cleanSubjectFromSubject(subject) || '(No Subject)',
              firstMessageDate: sentAt,
              participants: [
                { email: from.email, name: from.name, role: 'sender', isInternal: false },
                ...to.map((t) => ({
                  email: t.email,
                  name: t.name,
                  role: 'recipient',
                  isInternal: false,
                })),
                ...cc.map((c) => ({ email: c.email, name: c.name, role: 'cc', isInternal: false })),
                ...bcc.map((b) => ({
                  email: b.email,
                  name: b.name,
                  role: 'bcc',
                  isInternal: false,
                })),
              ],
              messageReferences: [
                {
                  messageId: messageIdHeader,
                  inReplyTo: getHeader('In-Reply-To'),
                  references: getHeader('References')?.split(/\s+/) || [],
                },
              ],
            },
            $addToSet: { emails: existingEmail._id },
            $set: {
              lastMessageDate: sentAt,
              lastActivity: sentAt,
              latestMessage: {
                content: message.data.snippet || '',
                sender: from.name || from.email,
                timestamp: sentAt,
                type: 'email',
              },
            },
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
          },
        );

        // Update participant hash after thread update
        const allParticipants = [
          { email: from.email, name: from.name, role: 'sender', isInternal: false },
          ...to.map((t) => ({
            email: t.email,
            name: t.name,
            role: 'recipient',
            isInternal: false,
          })),
          ...cc.map((c) => ({ email: c.email, name: c.name, role: 'cc', isInternal: false })),
          ...bcc.map((b) => ({ email: b.email, name: b.name, role: 'bcc', isInternal: false })),
        ];

        // Add new participants if any
        allParticipants.forEach((participant) => {
          if (!thread.participants.some((p) => p.email === participant.email)) {
            thread.participants.push(participant);
          }
        });

        // Update participant hash
        thread.participantHash = this.generateParticipantHash(thread.participants);
        await thread.save();

        console.info('[Gmail] Duplicate email added to thread:', {
          emailId: existingEmail._id,
          threadId: thread._id,
          workspaceId: integration.workspace._id,
        });

        return;
      }

      // Process email body and attachments
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

      console.log('[Gmail Debug] Final body content before storage:', {
        messageId,
        hasBody: !!body,
        bodyLength: body?.length,
        isHtml: body?.includes('<html') || body?.includes('<body'),
        preview: body?.substring(0, 100) + '...',
      });

      // Extract and format email details
      const fromHeader = getHeader('From');
      const toHeader = getHeader('To');
      const ccHeader = getHeader('Cc');
      const bccHeader = getHeader('Bcc');
      const subject = getHeader('Subject');
      const threadId = message.data.threadId;
      const sentAt = new Date(getHeader('Date'));

      // Format email addresses using the class method
      const from = this.formatEmailAddress(fromHeader, 'from');
      const to = toHeader
        ? toHeader.split(',').map((addr) => this.formatEmailAddress(addr, 'to'))
        : [];
      const cc = ccHeader
        ? ccHeader.split(',').map((addr) => this.formatEmailAddress(addr, 'cc'))
        : [];
      const bcc = bccHeader
        ? bccHeader.split(',').map((addr) => this.formatEmailAddress(addr, 'bcc'))
        : [];

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

      // Create email document with atomic operation
      const email = await Email.findOneAndUpdate(
        {
          gmailMessageId: messageId,
          workspaceId: integration.workspace._id,
        },
        {
          $setOnInsert: {
            subject: subject || '(No Subject)',
            body: {
              html: body || '',
              text: body ? body.replace(/<[^>]*>/g, '') : '',
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
            token: {
              id: messageId,
              type: 'gmail',
              accessToken: integration.accessToken,
              refreshToken: integration.refreshToken,
              scope: 'https://www.googleapis.com/auth/gmail.readonly',
              expiryDate: integration.tokenExpiry,
            },
            threadPart: parseInt(threadId, 16) || 0,
            historyId: message.data.historyId,
            internalDate: message.data.internalDate,
            snippet: message.data.snippet || '',
            userId: integration.workspace._id.toString(),
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      );

      // Handle thread creation/update with atomic operations
      const thread = await EmailThread.findOneAndUpdate(
        { threadId },
        {
          $setOnInsert: {
            workspaceId: integration.workspace._id,
            title: this.generateThreadTitle(subject, from),
            subject: subject || '(No Subject)',
            cleanSubject: this.cleanSubjectFromSubject(subject) || '(No Subject)',
            participants: [
              { email: from.email, name: from.name, role: 'sender', isInternal: false },
              ...to.map((t) => ({
                email: t.email,
                name: t.name,
                role: 'recipient',
                isInternal: false,
              })),
              ...cc.map((c) => ({ email: c.email, name: c.name, role: 'cc', isInternal: false })),
              ...bcc.map((b) => ({ email: b.email, name: b.name, role: 'bcc', isInternal: false })),
            ],
            firstMessageDate: sentAt,
            messageReferences: [
              {
                messageId: messageIdHeader,
                inReplyTo: getHeader('In-Reply-To'),
                references: getHeader('References')?.split(/\s+/) || [],
              },
            ],
          },
          $addToSet: { emails: email._id },
          $set: {
            lastMessageDate: sentAt,
            lastActivity: sentAt,
            latestMessage: {
              content: message.data.snippet || this.generateMessagePreview(body),
              sender: from.name || from.email,
              timestamp: sentAt,
              type: 'email',
            },
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      );

      // If this is a new thread, check if there's an existing thread with the same subject and participants
      if (!thread.emails || thread.emails.length === 1) {
        const potentialThreads = await EmailThread.find({
          workspaceId: integration.workspace._id,
          cleanSubject: this.cleanSubjectFromSubject(subject),
          _id: { $ne: thread._id },
        });

        for (const potentialThread of potentialThreads) {
          // Check if this email should be part of the potential thread
          if (await potentialThread.shouldIncludeEmail(email)) {
            // Merge the threads
            await potentialThread.mergeThread(thread);
            // Delete the duplicate thread
            await EmailThread.findByIdAndDelete(thread._id);
            console.info('[Gmail] Merged duplicate thread:', {
              originalThreadId: potentialThread._id,
              duplicateThreadId: thread._id,
              emailId: email._id,
            });
            return;
          }
        }
      }

      // Update participant hash after thread creation/update
      const allParticipants = thread.participants;
      thread.participantHash = this.generateParticipantHash(allParticipants);
      await thread.save();

      console.info('[Gmail] Email and thread processed successfully:', {
        emailId: email._id,
        threadId: thread._id,
        workspaceId: email.workspaceId,
        attachmentsCount: formattedAttachments.length,
        inlineImagesCount: formattedInlineImages.length,
      });
    } catch (error) {
      // Handle 404 errors gracefully (email not found)
      if (error.code === 404) {
        console.warn('[Gmail] Email not found:', messageId);
        return;
      }
      console.error('[Gmail] Error processing email:', error);
      throw error;
    }
  }

  /**
   * Generate a thread title from subject and sender
   */
  generateThreadTitle(subject, from) {
    // Remove common prefixes like Re:, Fwd:, etc.
    const cleanSubject = subject.replace(/^(Re|Fwd|Fw|R|F):\s*/i, '').trim();

    // If subject is empty or just contains prefixes, use sender's name
    if (!cleanSubject || cleanSubject === '') {
      return `Conversation with ${from.name || from.email.split('@')[0]}`;
    }

    // If subject is too long, truncate it
    if (cleanSubject.length > 100) {
      return cleanSubject.substring(0, 97) + '...';
    }

    return cleanSubject;
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
      console.log('[Gmail Debug] Initial body content:', {
        messageId,
        hasBody: !!result.body,
        bodyLength: result.body?.length,
        mimeType: part.mimeType,
        isMultipart: part.mimeType?.startsWith('multipart/'),
      });

      // Sanitize HTML content
      if (result.body) {
        const originalBody = result.body;
        result.body = this.sanitizeHtml(result.body);
        console.log('[Gmail Debug] After sanitization:', {
          messageId,
          originalLength: originalBody.length,
          sanitizedLength: result.body.length,
          wasChanged: originalBody !== result.body,
        });
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
    console.log('[Gmail Debug] Extracting content:', {
      mimeType: part.mimeType,
      hasBody: !!part.body?.data,
      targetTypes: types,
    });

    // First try to find HTML content
    if (part.mimeType === 'text/html' && part.body?.data) {
      const content = Buffer.from(part.body.data, 'base64url').toString();
      console.log('[Gmail Debug] Found HTML content:', {
        mimeType: part.mimeType,
        contentLength: content.length,
        isHtml: true,
        preview: content.substring(0, 100) + '...',
      });
      return content;
    }

    // If no HTML content found, try to find plain text
    if (part.mimeType === 'text/plain' && part.body?.data) {
      const content = Buffer.from(part.body.data, 'base64url').toString();
      console.log('[Gmail Debug] Found plain text content:', {
        mimeType: part.mimeType,
        contentLength: content.length,
        isHtml: false,
        preview: content.substring(0, 100) + '...',
      });
      return content;
    }

    // If no direct match, check parts
    if (part.parts?.length) {
      // First try to find HTML in parts
      for (const sub of part.parts) {
        if (sub.mimeType === 'text/html') {
          const res = this.extractFirstMatching(sub, types);
          if (res) return res;
        }
      }
      // If no HTML found, try plain text
      for (const sub of part.parts) {
        if (sub.mimeType === 'text/plain') {
          const res = this.extractFirstMatching(sub, types);
          if (res) return res;
        }
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
        console.warn(`[Gmail] Attachment too large (${decodedData.length} bytes), skipping upload`);
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
      console.error('[Gmail] Error processing attachment:', error);
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

  /**
   * Generate Gravatar URL for an email address
   */
  generateGravatarUrl(email) {
    if (!email) return null;
    const address = String(email).trim().toLowerCase();
    const hash = sha256(address);
    return `https://gravatar.com/avatar/${hash}`;
  }

  /**
   * Format email address into rich contact format
   */
  formatEmailAddress(emailStr, role = 'from') {
    if (!emailStr) return null;

    // Handle both string and object inputs
    let name = '';
    let email = '';

    if (typeof emailStr === 'string') {
      const match = emailStr.match(/(.*?)\s*<([^>]+)>/) || [null, null, emailStr];
      name = match[1]?.trim() || '';
      email = match[2]?.trim() || match[3]?.trim() || emailStr.trim();
    } else if (typeof emailStr === 'object') {
      name = emailStr.name || '';
      email = emailStr.email || '';
    }

    if (!email) return null;

    const timestamp = Date.now();
    const displayName = name || email.split('@')[0];
    const initials = displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();

    // Generate avatar URLs
    const gravatarUrl = this.generateGravatarUrl(email);
    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName,
    )}&background=random`;

    return {
      id: timestamp,
      avatar_type: 'contact',
      class: 'contact',
      source: 'email',
      url: `/api/contacts/${timestamp}`,
      namespace: 'global',
      name: displayName,
      card_name: displayName,
      handle: email,
      email: email,
      display_name: displayName,
      description: null,
      avatar: gravatarUrl || fallbackAvatar,
      initials: initials,
      channel_id: null,
      channel_full: null,
      inbox_alias: null,
      message_type: null,
      card_id: timestamp,
      card_url: `/api/cards/${timestamp}`,
      links: [],
      num_notes: 0,
      extra: {
        email: email,
      },
      phone: null,
      company: null,
      job_title: null,
      location: null,
      social_profiles: {},
      tags: [],
      last_contacted: new Date(),
      contact_frequency: 0,
      contact_notes: [],
      card: {
        id: timestamp,
        namespace: 'global',
        avatar_type: 'contact',
        class: 'card',
        url: `/api/cards/${timestamp}`,
        name: displayName,
        display_name: displayName,
        avatar: gravatarUrl || fallbackAvatar,
        initials: initials,
        color: '#a385e0',
        num_notes: 0,
        namespace_to_num_notes: {},
        autogenerated: false,
        edited: false,
        created_at: timestamp,
        updated_at: timestamp,
        type: 'auto',
        bio: null,
        description: null,
        links: [],
        groups: [],
        external_info: null,
        custom_field_attributes: [],
        metadata: {},
        last_updated_by: null,
        version: 1,
        contacts: [
          {
            id: timestamp,
            url: `/api/contacts/${timestamp}`,
            source: 'email',
            handle: email,
            is_primary: true,
            verified: false,
            verification_date: null,
            last_used: new Date(),
          },
        ],
      },
      fallback: null,
      role: role,
      is_spammer: false,
      recipient_url: `/api/recipients/${timestamp}`,
      last_interaction: new Date(),
      interaction_count: 0,
      status: 'active',
      preferences: {},
    };
  }

  /**
   * Generate a preview of the message content
   */
  generateMessagePreview(content) {
    if (!content) return '';

    // Remove HTML tags and decode HTML entities
    const plainText = content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/&#39;/g, "'") // Replace &#39; with '
      .trim();

    // Truncate to 200 characters and add ellipsis if needed
    return plainText.length > 200 ? plainText.substring(0, 197) + '...' : plainText;
  }

  /**
   * Clean subject by removing prefixes
   */
  cleanSubjectFromSubject(subject) {
    return subject
      .replace(/^(Re|Fwd|Fw|R|F):\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generate participant hash
   */
  generateParticipantHash(participants) {
    const sortedEmails = participants
      .map((p) => p.email.toLowerCase())
      .sort()
      .join('|');
    return createHash('sha256').update(sortedEmails).digest('hex');
  }
}

// Create and export a singleton instance
const gmailListenerService = new GmailListenerService();
export default gmailListenerService;
