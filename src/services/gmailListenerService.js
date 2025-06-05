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
import { registerShutdownHandler } from '../utils/shutdownHandler.js';

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
    this.serverId = process.env.SERVER_ID || `server-${Date.now()}`; // Unique server identifier
    this.isInitialized = false;
    this.setupShutdownHandlers();
  }

  /**
   * Set up shutdown handlers for graceful termination
   */
  setupShutdownHandlers() {
    // Register with the centralized shutdown handler
    registerShutdownHandler(async () => {
      console.info('[Gmail] Initiating graceful shutdown...');
      await this.stop();
    });
  }

  /**
   * Initialize the service with MongoDB connection
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Wait for MongoDB connection to be ready
      if (mongoose.connection.readyState !== 1) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('MongoDB connection timeout'));
          }, 30000); // 30 second timeout

          mongoose.connection.once('connected', () => {
            clearTimeout(timeout);
            resolve();
          });

          mongoose.connection.once('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      }

      // Double check connection is ready
      if (mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB connection not ready');
      }

      // Create indexes for the locks collection
      const db = mongoose.connection.db;
      if (!db) {
        throw new Error('MongoDB database not available');
      }

      await db.collection('locks').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await db.collection('locks').createIndex({ serverId: 1 });

      this.isInitialized = true;
      console.info('[Gmail] Service initialized successfully');
    } catch (error) {
      console.error('[Gmail] Error initializing service:', error);
      throw error;
    }
  }

  /**
   * Start Gmail listener for all workspaces with active Gmail integrations
   */
  async start() {
    try {
      // Initialize the service first
      await this.initialize();

      // Find all active Gmail integrations
      const integrations = await GmailIntegration.find({ isActive: true }).populate(
        'workspace',
        'name',
      );

      // Set up watch for each integration
      for (const integration of integrations) {
        await this.setupWatchForIntegration(integration);
      }

      console.info('[Gmail] Watch service started on server:', this.serverId);
    } catch (error) {
      console.error('[Gmail] Error starting watch service:', error);
      throw error;
    }
  }

  /**
   * Set up watch for a specific Gmail integration
   */
  async setupWatchForIntegration(integration) {
    try {
      const shouldRefresh = true;
      if (!shouldRefresh || !integration.isActive) {
        console.log(`[Gmail Watch] Skipping: ${integration.email}`);
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
        expiry_date: integration.tokenExpiry?.getTime(),
      });

      // Set up token refresh handler
      oauth2Client.on('tokens', async (tokens) => {
        if (tokens.refresh_token) {
          integration.refreshToken = tokens.refresh_token;
        }
        integration.accessToken = tokens.access_token;
        integration.tokenExpiry = new Date(tokens.expiry_date);
        await integration.save();
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const res = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: 'projects/hour-block/topics/gmail-push-notify',
          labelIds: ['INBOX'],
        },
      });

      integration.watchExpiration = new Date(Number(res.data.expiration));
      integration.historyId = res.data.historyId;
      await integration.save();

      console.log(`[Gmail Watch] Registered for ${integration.email}`);
      return true;
    } catch (error) {
      console.error(`[Gmail Watch] Failed ${integration.email}:`, error.message);
      return false;
    }
  }

  /**
   * Handle push notification from Gmail
   */
  async handlePushNotification(integration, historyId) {
    console.info('[Gmail Push] Starting push notification handling:', {
      email: integration.email,
      workspaceId: integration.workspace._id,
      historyId,
      timestamp: new Date().toISOString(),
      serverId: this.serverId,
    });

    try {
      // Create OAuth client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI,
      );

      console.log('[Gmail Push] OAuth client created');

      // Set credentials
      oauth2Client.setCredentials({
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken,
        expiry_date: integration.tokenExpiry?.getTime(),
      });

      console.log('[Gmail Push] OAuth credentials set');

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Get current profile to check history ID
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log('[Gmail Push] Current Gmail profile:', {
        email: profile.data.emailAddress,
        currentHistoryId: profile.data.historyId,
        ourHistoryId: historyId,
        difference: Number(profile.data.historyId) - Number(historyId),
        lastSynced: integration.lastSynced?.toISOString(),
        timeSinceLastSync: integration.lastSynced
          ? Math.round((Date.now() - integration.lastSynced.getTime()) / 1000) + ' seconds'
          : 'never',
      });

      // List changes since last history ID
      console.log('[Gmail Push] Fetching history since:', historyId);
      const history = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: historyId,
        historyTypes: ['messageAdded'],
      });

      // Update history ID
      if (history.data.historyId) {
        console.log('[Gmail Push] Updating history ID:', {
          oldHistoryId: historyId,
          newHistoryId: history.data.historyId,
          difference: Number(history.data.historyId) - Number(historyId),
          historyLength: history.data.history?.length || 0,
          nextPageToken: history.data.nextPageToken ? 'present' : 'none',
        });
        integration.historyId = history.data.historyId;
        await integration.save();
      }

      // No changes
      if (!history.data.history || !history.data.history.length) {
        console.log('[Gmail Push] No new changes found. History response:', {
          historyId: history.data.historyId,
          historyLength: history.data.history?.length || 0,
          nextPageToken: history.data.nextPageToken ? 'present' : 'none',
          timeSinceLastSync: integration.lastSynced
            ? Math.round((Date.now() - integration.lastSynced.getTime()) / 1000) + ' seconds'
            : 'never',
        });
        return;
      }

      console.log('[Gmail Push] Processing history records:', {
        recordCount: history.data.history.length,
      });

      // Process each history record
      for (const record of history.data.history) {
        if (record.messagesAdded) {
          console.log('[Gmail Push] Processing messages:', {
            messageCount: record.messagesAdded.length,
          });
          for (const messageAdded of record.messagesAdded) {
            await this.processEmail(gmail, integration, messageAdded.message.id);
          }
        }
      }

      // Update last synced timestamp
      integration.lastSynced = new Date();
      await integration.save();
      console.info('[Gmail Push] Successfully completed push notification handling:', {
        email: integration.email,
        workspaceId: integration.workspace._id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Gmail Push] Error handling push notification:', {
        error: error.message,
        stack: error.stack,
        email: integration.email,
        workspaceId: integration.workspace._id,
        historyId,
      });

      // If token expired or invalid, deactivate the integration
      if (error.code === 401) {
        console.warn('[Gmail Push] Token expired or invalid, deactivating integration:', {
          email: integration.email,
          workspaceId: integration.workspace._id,
        });
        integration.isActive = false;
        await integration.save();
      }
      throw error;
    }
  }

  /**
   * Process a specific email message
   */
  async processEmail(gmail, integration, messageId) {
    try {
      // Log new incoming email
      console.info('[Gmail] New email received:', {
        messageId,
        workspaceId: integration.workspace._id,
        workspaceName: integration.workspace.name,
        email: integration.email,
        timestamp: new Date().toISOString(),
      });

      // Try to acquire lock before processing
      const lockAcquired = await this.acquireLock(messageId, integration.workspace._id);
      if (!lockAcquired) {
        console.log(
          '[Gmail] Skipping email processing - already being processed by another server:',
          {
            messageId,
            workspaceId: integration.workspace._id,
          },
        );
        return;
      }

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
          console.log('[Gmail] Duplicate email detected, skipping processing:', {
            messageId,
            gmailMessageId: messageId,
            workspaceId: integration.workspace._id,
            existingEmailId: existingEmail._id,
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

        // Enhanced empty email detection
        const isEmptyEmail = this.isEmailEmpty(body, message.data.snippet);
        if (isEmptyEmail) {
          console.log('[Gmail] Skipping empty email:', {
            messageId,
            workspaceId: integration.workspace._id,
            timestamp: new Date().toISOString(),
            snippet: message.data.snippet,
            bodyLength: body?.length,
          });
          return;
        }

        // Log detailed body content analysis
        console.log('[Gmail Debug] Email content analysis:', {
          messageId,
          hasBody: !!body,
          bodyLength: body?.length,
          isHtml: body?.includes('<html') || body?.includes('<body'),
          isEmpty: isEmptyEmail,
          preview: body?.substring(0, 100) + '...',
          headers: {
            subject: getHeader('Subject'),
            from: getHeader('From'),
            to: getHeader('To'),
            date: getHeader('Date'),
            messageId: messageIdHeader,
            inReplyTo: getHeader('In-Reply-To'),
            references: getHeader('References'),
          },
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

        // First check if there's an existing thread with the same subject and participants
        const potentialThreads = await EmailThread.find({
          workspaceId: integration.workspace._id,
          $or: [
            { threadId: threadId }, // First check for exact threadId match
            { cleanSubject: this.cleanSubjectFromSubject(subject) }, // Then check for subject match
          ],
        });

        let targetThread = null;
        for (const potentialThread of potentialThreads) {
          // If we found a thread with matching threadId, use that
          if (potentialThread.threadId === threadId) {
            targetThread = potentialThread;
            break;
          }
          // Otherwise check if this email should be part of the potential thread
          if (await potentialThread.shouldIncludeEmail(email)) {
            targetThread = potentialThread;
            break;
          }
        }

        // If we found a matching thread, update it
        if (targetThread) {
          await EmailThread.findByIdAndUpdate(
            targetThread._id,
            {
              $addToSet: { emails: email._id },
              $set: {
                lastMessageDate: sentAt,
                lastActivity: sentAt,
                latestMessage: {
                  content: message.data.snippet || this.generateMessagePreview(body),
                  sender: from.name || from.email,
                  timestamp: sentAt,
                  type: 'email',
                  isRead: false,
                },
              },
            },
            { new: true },
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
            if (!targetThread.participants.some((p) => p.email === participant.email)) {
              targetThread.participants.push(participant);
            }
          });

          // Update participant hash
          targetThread.participantHash = this.generateParticipantHash(targetThread.participants);
          await targetThread.save();

          console.info('[Gmail] Email added to existing thread:', {
            emailId: email._id,
            threadId: targetThread._id,
            workspaceId: integration.workspace._id,
          });
        } else {
          // If no matching thread found, create a new one
          const participants = [
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

          const participantHash = this.generateParticipantHash(participants);

          const thread = await EmailThread.create({
            threadId,
            workspaceId: integration.workspace._id,
            title: this.generateThreadTitle(subject, from),
            subject: subject || '(No Subject)',
            cleanSubject: this.cleanSubjectFromSubject(subject) || '(No Subject)',
            participants,
            emails: [email._id],
            messageReferences: [
              {
                messageId: messageIdHeader,
                inReplyTo: getHeader('In-Reply-To'),
                references: getHeader('References')?.split(/\s+/) || [],
              },
            ],
            firstMessageDate: sentAt,
            lastMessageDate: sentAt,
            lastActivity: sentAt,
            participantHash,
            latestMessage: {
              content: message.data.snippet || this.generateMessagePreview(body),
              sender: from.name || from.email,
              timestamp: sentAt,
              type: 'email',
              isRead: false,
            },
          });

          console.info('[Gmail] New thread created:', {
            emailId: email._id,
            threadId: thread._id,
            workspaceId: integration.workspace._id,
          });
        }
      } finally {
        // Always release the lock when done
        await this.releaseLock(messageId, integration.workspace._id);
      }
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
  async stop() {
    try {
      // Clean up any locks owned by this server
      if (this.isInitialized && mongoose.connection.readyState === 1) {
        const db = mongoose.connection.db;
        if (db) {
          await db.collection('locks').deleteMany({
            serverId: this.serverId,
          });
        }
      }

      // Mark service as not initialized
      this.isInitialized = false;

      console.info('[Gmail] Watch service stopped on server:', this.serverId);
    } catch (error) {
      console.error('[Gmail] Error stopping watch service:', error);
      throw error;
    }
  }

  /**
   * Add a new Gmail integration to the watch service
   */
  async addIntegration(integration) {
    return await this.setupWatchForIntegration(integration);
  }

  /**
   * Remove a Gmail integration from the watch service
   */
  async removeIntegration(workspaceId, email) {
    try {
      const integration = await GmailIntegration.findOne({
        workspace: workspaceId,
        email: email,
      });

      if (integration) {
        integration.isActive = false;
        await integration.save();
        return true;
      }

      return false;
    } catch (error) {
      console.error('[Gmail] Error removing integration:', error);
      return false;
    }
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

  /**
   * Acquire a lock for processing an email
   * @param {string} messageId - The Gmail message ID
   * @param {string} workspaceId - The workspace ID
   * @returns {Promise<boolean>} - Whether the lock was acquired
   */
  async acquireLock(messageId, workspaceId) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    try {
      const db = mongoose.connection.db;
      if (!db) {
        throw new Error('MongoDB database not available');
      }

      const lockId = `${workspaceId}-${messageId}`;
      const lockExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      const result = await db.collection('locks').updateOne(
        {
          _id: lockId,
          $or: [{ expiresAt: { $lt: new Date() } }, { serverId: this.serverId }],
        },
        {
          $set: {
            serverId: this.serverId,
            expiresAt: lockExpiry,
            messageId,
            workspaceId,
          },
        },
        { upsert: true },
      );

      return result.modifiedCount > 0 || result.upsertedCount > 0;
    } catch (error) {
      console.error('[Gmail] Error acquiring lock:', error);
      return false;
    }
  }

  /**
   * Release a lock for an email
   * @param {string} messageId - The Gmail message ID
   * @param {string} workspaceId - The workspace ID
   */
  async releaseLock(messageId, workspaceId) {
    if (!this.isInitialized) {
      return;
    }

    try {
      const db = mongoose.connection.db;
      if (!db) {
        return;
      }

      const lockId = `${workspaceId}-${messageId}`;
      await db.collection('locks').deleteOne({
        _id: lockId,
        serverId: this.serverId,
      });
    } catch (error) {
      console.error('[Gmail] Error releasing lock:', error);
    }
  }

  /**
   * Check if an email is empty
   * @param {string|object} body - The email body content (can be string or object with text/html)
   * @param {string} snippet - The email snippet from Gmail
   * @returns {boolean} - Whether the email is considered empty
   */
  isEmailEmpty(body, snippet) {
    if (!body && !snippet) return true;

    // Check for common empty email patterns
    const emptyPatterns = [
      '', // Empty string
      '<br>',
      '<div dir="ltr"><br></div>',
      '<div><br></div>',
      '<p><br></p>',
      '&nbsp;',
      ' ',
      '\n',
      '\r\n',
      '\t',
    ];

    // Handle both string and object body formats
    let textContent = '';
    let htmlContent = '';

    if (typeof body === 'object' && body !== null) {
      textContent = body.text || '';
      htmlContent = body.html || '';
    } else {
      textContent = body || '';
      htmlContent = body || '';
    }

    // Clean the text content
    const cleanText = textContent
      .replace(/\s+/g, ' ') // Replace multiple spaces/newlines with single space
      .trim();

    // Clean the HTML content
    const cleanHtml = htmlContent
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();

    // Check if either text or HTML content matches empty patterns
    if (
      emptyPatterns.includes(textContent) ||
      emptyPatterns.includes(cleanText) ||
      emptyPatterns.includes(htmlContent) ||
      emptyPatterns.includes(cleanHtml)
    ) {
      return true;
    }

    // Check if snippet is empty or just whitespace
    if (!snippet || snippet.trim() === '') {
      return true;
    }

    return false;
  }
}

// Create and export a singleton instance
const gmailListenerService = new GmailListenerService();
export default gmailListenerService;
