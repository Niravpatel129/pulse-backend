import { createHash } from 'crypto';
import createDOMPurify from 'dompurify';
import { google } from 'googleapis';
import sha256 from 'js-sha256';
import { JSDOM } from 'jsdom';
import mongoose from 'mongoose';
import Email from '../models/Email.js';
import EmailThread from '../models/Email/EmailThreadModel.js';
import GmailIntegration from '../models/GmailIntegration.js';
import computeExpiry from '../utils/computeExpiry.js';
import { firebaseStorage } from '../utils/firebase.js';
import { registerShutdownHandler } from '../utils/shutdownHandler.js';
import attachmentService from './attachmentService.js';

// Initialize DOMPurify
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Constants
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20MB
const THUMBNAIL_SIZE = 200; // 200px for thumbnail width/height

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

// Supported thumbnail MIME types
const THUMBNAIL_SUPPORTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

class GmailListenerService {
  constructor() {
    this.serverId = process.env.SERVER_ID || `server-${Date.now()}`; // Unique server identifier
    this.processingQueue = new Map(); // Track emails being processed
    this.debounceTimers = new Map(); // Track debounce timers
    this.DEBOUNCE_DELAY = 2000; // 2 seconds debounce
    this.isInitialized = false;
    this.threadParts = new Map(); // Track parts of threads being processed
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
        if (tokens.expiry_date || tokens.expires_in) {
          integration.tokenExpiry = computeExpiry(tokens);
        }
        integration.refreshTokenLastUsedAt = new Date();
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

      // Set credentials
      oauth2Client.setCredentials({
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken,
        expiry_date: integration.tokenExpiry?.getTime(),
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Get current profile to check history ID
      const profile = await gmail.users.getProfile({ userId: 'me' });
      // console.log('[Gmail Push] Current Gmail profile:', {
      //   email: profile.data.emailAddress,
      //   currentHistoryId: profile.data.historyId,
      //   ourHistoryId: historyId,
      //   difference: Number(profile.data.historyId) - Number(historyId),
      // });

      // List changes since last history ID
      // console.log('[Gmail Push] Fetching history since:', historyId);
      const history = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: historyId,
        historyTypes: ['messageAdded'],
      });

      // No changes
      if (!history.data.history || !history.data.history.length) {
        // console.log('[Gmail Push] No new changes found');
        return;
      }

      // Group messages by thread ID
      const threadMessages = new Map();

      // Process history records
      for (const record of history.data.history) {
        if (!record.messagesAdded) continue;

        for (const { message } of record.messagesAdded) {
          try {
            // Get the full message to check its labels and thread ID
            const fullMessage = await gmail.users.messages.get({
              userId: 'me',
              id: message.id,
              format: 'metadata',
              metadataHeaders: ['Thread-Id'],
            });

            // Skip drafts
            if (fullMessage.data.labelIds?.includes('DRAFT')) {
              console.log('[Gmail] Skipping draft message:', {
                messageId: message.id,
                threadId: fullMessage.data.threadId,
              });
              continue;
            }

            const threadId = fullMessage.data.threadId;

            // Group messages by thread ID
            if (!threadMessages.has(threadId)) {
              threadMessages.set(threadId, []);
            }
            threadMessages.get(threadId).push(message.id);
          } catch (error) {
            console.error('[Gmail] Error getting message metadata:', {
              error: error.message,
              messageId: message.id,
            });
            continue;
          }
        }
      }

      // Process each thread's messages together
      for (const [threadId, messageIds] of threadMessages) {
        try {
          // Get the first message in the thread
          const firstMessageId = messageIds[0];

          // Check if we already have this thread in our database
          const existingThread = await EmailThread.findOne({
            threadId,
            workspaceId: integration.workspace._id,
          });

          if (existingThread) {
            // If thread exists, process all messages to update attachments
            for (const messageId of messageIds) {
              await this.processEmail(gmail, integration, messageId);
            }
          } else {
            // If thread doesn't exist, process the first message to create it
            await this.processEmail(gmail, integration, firstMessageId);

            // Then process remaining messages to add any missing attachments
            for (const messageId of messageIds.slice(1)) {
              await this.processEmail(gmail, integration, messageId);
            }
          }
        } catch (error) {
          console.error('[Gmail] Error processing thread:', {
            error: error.message,
            threadId,
            messageIds,
          });
          continue;
        }
      }

      // Update history ID after successful processing
      integration.historyId = history.data.historyId;
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
   * Process a single email
   */
  async processEmail(gmail, integration, messageId) {
    try {
      console.log('[Gmail] Processing email:', {
        messageId,
        workspaceId: integration.workspace._id,
        workspaceName: integration.workspace.name,
        email: integration.email,
        timestamp: new Date().toISOString(),
      });

      // Acquire lock for this message
      const lock = await this.acquireLock(messageId, integration.workspace._id);
      if (!lock) {
        console.log('[Gmail] Skipping duplicate message:', { messageId });
        return;
      }

      try {
        // Get full message with retry logic
        let message;
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 1000; // 1 second

        while (retryCount < maxRetries) {
          try {
            message = await gmail.users.messages.get({
              userId: 'me',
              id: messageId,
              format: 'full',
            });
            break;
          } catch (error) {
            if (
              error.message === 'Requested entity was not found.' &&
              retryCount < maxRetries - 1
            ) {
              console.log('[Gmail] Message not found, retrying...', {
                messageId,
                retryCount: retryCount + 1,
                maxRetries,
              });
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
              retryCount++;
            } else {
              throw error;
            }
          }
        }

        if (!message?.data) {
          throw new Error('Invalid message data received from Gmail');
        }

        // Check if email already exists
        const existingEmail = await Email.findOne({
          gmailMessageId: message.data.id,
          workspaceId: integration.workspace._id,
        });

        if (existingEmail) {
          console.log('[Gmail] Updating existing email:', {
            messageId,
            emailId: existingEmail._id,
          });
          return await this.updateExistingEmail(existingEmail, message, gmail);
        }

        // Get headers
        const headers = message.data.payload.headers;
        if (!headers || !Array.isArray(headers)) {
          throw new Error('Invalid message: missing or invalid headers');
        }

        const getHeader = (name) =>
          headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        // Extract and format email details
        const fromHeader = getHeader('From');
        const toHeader = getHeader('To');
        const ccHeader = getHeader('Cc');
        const bccHeader = getHeader('Bcc');
        const subject = getHeader('Subject');
        const threadId = message.data.threadId;
        const sentAt = new Date(getHeader('Date'));
        const messageIdHeader = getHeader('Message-ID');

        if (!fromHeader) {
          throw new Error('Invalid message: missing From header');
        }

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

        // Process message parts
        const parts = [];
        const attachments = [];
        const inlineImages = [];

        // Process message structure
        const processPart = async (part, parentMimeType = null) => {
          const partData = {
            mimeType: part.mimeType,
            contentId: part.contentId,
            filename: part.filename,
            headers: part.headers || [],
          };

          if (part.mimeType === 'multipart/alternative' || part.mimeType === 'multipart/mixed') {
            partData.parts = [];
            for (const subPart of part.parts || []) {
              const processedSubPart = await processPart(subPart, part.mimeType);
              if (processedSubPart) {
                partData.parts.push(processedSubPart);
              }
            }
          } else if (part.body?.data) {
            try {
              partData.content = Buffer.from(part.body.data, 'base64').toString();
            } catch (error) {
              console.error('[Gmail] Error decoding part content:', {
                error: error.message,
                messageId,
                mimeType: part.mimeType,
              });
              // If we can't decode the content, set a placeholder
              partData.content = '(Content decoding failed)';
            }
          } else if (part.filename) {
            const attachment = await this.processAttachment(
              gmail,
              messageId,
              part,
              integration.workspace._id,
            );
            if (attachment) {
              if (part.contentId) {
                inlineImages.push(attachment);
              } else {
                attachments.push(attachment);
              }
            }
          }

          // Only return the part if it has content or subparts
          if (partData.content || (partData.parts && partData.parts.length > 0)) {
            return partData;
          }
          return null;
        };

        // Process the main message structure
        const messageStructure = await processPart(message.data.payload);
        if (messageStructure) {
          parts.push(messageStructure);
        }

        // If no parts were processed successfully, create a minimal structure
        if (parts.length === 0) {
          parts.push({
            mimeType: 'text/plain',
            content: '(No content available)',
            headers: [],
          });
        }

        // Create new email
        const email = new Email({
          gmailMessageId: message.data.id,
          threadId: message.data.threadId,
          userId: integration.workspace._id,
          workspaceId: integration.workspace._id,
          from,
          to,
          cc,
          bcc,
          subject: subject || '(No Subject)',
          body: {
            mimeType: message.data.payload.mimeType,
            parts,
            structure: messageStructure,
          },
          attachments,
          inlineImages,
          historyId: message.data.historyId,
          internalDate: new Date(parseInt(message.data.internalDate)),
          snippet: message.data.snippet || '(No preview available)',
          token: {
            accessToken: integration.accessToken,
            refreshToken: integration.refreshToken,
            expiryDate: integration.tokenExpiry,
            scope: 'https://www.googleapis.com/auth/gmail.readonly',
          },
          direction: 'inbound',
          status: 'received',
          sentAt,
          isSpam: message.data.labelIds?.includes('SPAM') || false,
          stage: message.data.labelIds?.includes('SPAM') ? 'spam' : 'unassigned',
          threadPart: 1,
          messageReferences: [
            {
              messageId: messageIdHeader,
              inReplyTo: getHeader('In-Reply-To'),
              references: getHeader('References')?.split(/\s+/) || [],
              type: 'original',
              position: 0,
            },
          ],
          labels:
            message.data.labelIds?.map((label) => ({
              name: label,
              color: this.getLabelColor(label),
            })) || [],
          headers: headers.map((h) => ({
            name: h.name,
            value: h.value,
          })),
        });

        await email.save();

        // Handle thread management
        await this.handleThreadManagement(email, {
          threadId,
          messageIdHeader,
          from,
          to,
          cc,
          bcc,
          subject,
          sentAt,
          getHeader,
          content: {
            text: messageStructure.content,
            html: messageStructure.content,
            attachments,
            inlineImages,
          },
        });

        return email;
      } finally {
        // Always release the lock
        await this.releaseLock(messageId, integration.workspace._id);
      }
    } catch (error) {
      // console.error('[Gmail] Error processing email:', {
      //   error: error.message,
      //   messageId,
      //   workspaceId: integration.workspace._id,
      // });
      throw error;
    }
  }

  /**
   * Update an existing email with new data
   */
  async updateExistingEmail(email, message, gmail) {
    try {
      if (!message?.data?.id || !message?.data?.threadId) {
        throw new Error('Invalid message data: missing id or threadId');
      }

      // Process email parts
      const {
        body,
        attachments = [],
        inlineImages = [],
      } = await this.processEmailParts(
        gmail,
        message.data.id,
        message.data.payload,
        email.workspaceId.toString(),
      );

      // Update email with new data
      if (body) {
        email.body.text = body.replace(/<[^>]*>/g, '');
        email.body.html = body;
      }

      // Add new attachments, avoiding duplicates based on filename and size
      if (attachments.length > 0) {
        const newAttachments = attachments.filter((newAtt) => {
          // Check if we already have an attachment with the same filename and size
          const isDuplicate = email.attachments.some(
            (existingAtt) =>
              existingAtt.filename === newAtt.filename && existingAtt.size === newAtt.size,
          );
          return !isDuplicate;
        });
        email.attachments.push(...newAttachments);
      }

      // Add new inline images, avoiding duplicates based on contentId
      if (inlineImages.length > 0) {
        const newInlineImages = inlineImages.filter(
          (newImg) =>
            !email.inlineImages.some((existingImg) => existingImg.contentId === newImg.contentId),
        );
        email.inlineImages.push(...newInlineImages);
      }

      // Update history ID
      email.historyId = message.data.historyId;
      email.syncedAt = new Date();

      await email.save();
      return email;
    } catch (error) {
      console.error('[Gmail] Error updating existing email:', {
        error: error.message,
        messageId: message?.data?.id,
        emailId: email?._id,
      });
      throw error;
    }
  }

  /**
   * Handle thread management for an email
   */
  async handleThreadManagement(
    email,
    { threadId, messageIdHeader, from, to, cc, bcc, subject, sentAt, getHeader, content },
  ) {
    try {
      // Find potential matching threads
      const potentialThreads = await EmailThread.find({
        workspaceId: email.workspaceId,
        $or: [
          // 1. First check for exact threadId match (Gmail's primary method)
          { threadId: threadId },
          // 2. Then check for message reference matches
          {
            'messageReferences.messageId': messageIdHeader,
            'messageReferences.inReplyTo': getHeader('In-Reply-To'),
            'messageReferences.references': { $in: getHeader('References')?.split(/\s+/) || [] },
          },
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
            $addToSet: {
              emails: email._id,
              messageReferences: {
                messageId: messageIdHeader,
                inReplyTo: getHeader('In-Reply-To'),
                references: getHeader('References')?.split(/\s+/) || [],
              },
            },
            $set: {
              lastMessageDate: sentAt,
              lastActivity: sentAt,
              isRead: false,
              latestMessage: {
                content: email.snippet || this.generateMessagePreview(content.text || content.html),
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
          workspaceId: email.workspaceId,
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
          workspaceId: email.workspaceId,
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
          stage: email.isSpam ? 'spam' : 'unassigned',
          latestMessage: {
            content: email.snippet || this.generateMessagePreview(content.text || content.html),
            sender: from.name || from.email,
            timestamp: sentAt,
            type: 'email',
            isRead: false,
          },
        });

        console.info('[Gmail] New thread created:', {
          emailId: email._id,
          threadId: thread._id,
          workspaceId: email.workspaceId,
        });
      }
    } catch (error) {
      console.error('[Gmail] Error handling thread management:', {
        error: error.message,
        emailId: email._id,
        threadId,
      });
      // Don't throw the error - we want to keep the email even if thread management fails
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
   * Process a Google Drive download link and convert it to Firebase storage
   */
  async processGoogleDriveLink(url, workspaceId) {
    try {
      // Extract file ID from the URL
      const fileIdMatch = url.match(/[?&]id=([^&]+)/);
      if (!fileIdMatch) {
        return null;
      }

      const fileId = fileIdMatch[1];

      // Create OAuth client for Google Drive
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI,
      );

      // Set credentials
      oauth2Client.setCredentials({
        access_token: process.env.GOOGLE_ACCESS_TOKEN,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      });

      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      // Get file metadata
      const file = await drive.files.get({
        fileId: fileId,
        fields: 'name,mimeType,size',
      });

      // Download file content
      const response = await drive.files.get(
        {
          fileId: fileId,
          alt: 'media',
        },
        { responseType: 'stream' },
      );

      // Generate storage path
      const filename = file.data.name;
      const storagePath = firebaseStorage.generatePath(workspaceId, filename);

      // Upload to Firebase Storage
      const { url: downloadUrl } = await firebaseStorage.uploadFile(
        response.data,
        storagePath,
        file.data.mimeType,
      );

      return {
        originalUrl: url,
        firebaseUrl: downloadUrl,
        filename: filename,
        mimeType: file.data.mimeType,
        size: file.data.size,
      };
    } catch (error) {
      console.error('[Gmail] Error processing Google Drive link:', error);
      return null;
    }
  }

  /**
   * Process email parts and extract content
   */
  async processEmailParts(gmail, messageId, part, workspaceId, options = {}) {
    try {
      const { targetTypes = ['text/html', 'text/plain'] } = options;
      let body = '';
      const attachments = [];
      const inlineImages = [];

      // Log initial content extraction
      console.log('[Gmail Debug] Extracting content:', {
        mimeType: part.mimeType,
        hasBody: !!part.body?.data,
        targetTypes,
      });

      if (part.mimeType === 'multipart/alternative' || part.mimeType === 'multipart/mixed') {
        // Process each part
        for (const subPart of part.parts || []) {
          const result = await this.processEmailParts(
            gmail,
            messageId,
            subPart,
            workspaceId,
            options,
          );
          body = result.body || body;
          attachments.push(...(result.attachments || []));
          inlineImages.push(...(result.inlineImages || []));
        }
      } else if (targetTypes.includes(part.mimeType)) {
        // Extract text content
        if (part.body?.data) {
          const content = Buffer.from(part.body.data, 'base64').toString();
          body = content;

          console.log('[Gmail Debug] Found content:', {
            mimeType: part.mimeType,
            contentLength: content.length,
            isHtml: part.mimeType === 'text/html',
            preview: content.substring(0, 50) + '...',
          });
        }
      } else if (part.filename) {
        // Process attachment
        try {
          const attachment = await this.processAttachment(gmail, messageId, part, workspaceId);
          if (attachment) {
            if (part.contentId) {
              inlineImages.push(attachment);
            } else {
              attachments.push(attachment);
            }
          }
        } catch (error) {
          console.error('[Gmail] Error processing attachment:', {
            error: error.message,
            filename: part.filename,
            messageId,
          });
        }
      }

      // Log final body content
      console.log('[Gmail Debug] Initial body content:', {
        messageId,
        hasBody: !!body,
        bodyLength: body.length,
        mimeType: part.mimeType,
        isMultipart: part.mimeType?.includes('multipart'),
      });

      return {
        body,
        attachments,
        inlineImages,
      };
    } catch (error) {
      // console.error('[Gmail] Error processing email parts:', {
      //   error: error.message,
      //   messageId,
      //   mimeType: part.mimeType,
      // });
      throw error;
    }
  }

  /**
   * Generate thumbnail for supported file types
   */
  async generateThumbnail(buffer, mimeType, filename) {
    try {
      // Skip if mime type is not supported for thumbnails
      if (!THUMBNAIL_SUPPORTED_TYPES.includes(mimeType)) {
        return null;
      }

      // For images, resize them directly
      if (mimeType.startsWith('image/')) {
        const sharp = require('sharp');

        // For SVG files, we need to convert to PNG first
        if (mimeType === 'image/svg+xml') {
          const svgBuffer = await sharp(buffer)
            .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .png()
            .toBuffer();

          // Generate thumbnail storage path
          const thumbnailPath = `workspaces/thumbnails/${Date.now()}_thumb_${filename.replace(
            '.svg',
            '.png',
          )}`;

          // Upload thumbnail to storage
          const { url: thumbnailUrl } = await firebaseStorage.uploadFile(
            svgBuffer,
            thumbnailPath,
            'image/png',
          );

          return {
            url: thumbnailUrl,
            path: thumbnailPath,
            width: THUMBNAIL_SIZE,
            height: THUMBNAIL_SIZE,
          };
        }

        // For other image types
        const thumbnailBuffer = await sharp(buffer)
          .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toBuffer();

        // Generate thumbnail storage path
        const thumbnailPath = `workspaces/thumbnails/${Date.now()}_thumb_${filename}`;

        // Upload thumbnail to storage
        const { url: thumbnailUrl } = await firebaseStorage.uploadFile(
          thumbnailBuffer,
          thumbnailPath,
          mimeType,
        );

        return {
          url: thumbnailUrl,
          path: thumbnailPath,
          width: THUMBNAIL_SIZE,
          height: THUMBNAIL_SIZE,
        };
      }

      // For PDFs and Office documents, we would need additional processing
      // This would require additional libraries like pdf-poppler for PDFs
      // and libreoffice for Office documents
      // For now, we'll return null for these types
      return null;
    } catch (error) {
      console.error('[Gmail] Error generating thumbnail:', {
        error: error.message,
        mimeType,
        filename,
      });
      return null;
    }
  }

  /**
   * Process a single attachment
   */
  async processAttachment(gmail, messageId, part, workspaceId) {
    return await attachmentService.processAttachment(gmail, messageId, part, workspaceId);
  }

  /**
   * Extract filename from email part
   */
  extractFilename(part) {
    return attachmentService.extractFilename(part);
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
   * Get color for a Gmail label
   */
  getLabelColor(label) {
    const labelColors = {
      INBOX: '#1a73e8',
      SENT: '#188038',
      DRAFT: '#ea4335',
      SPAM: '#ea4335',
      TRASH: '#5f6368',
      STARRED: '#fbbc04',
      IMPORTANT: '#ea4335',
      CATEGORY_PERSONAL: '#1a73e8',
      CATEGORY_SOCIAL: '#188038',
      CATEGORY_PROMOTIONS: '#ea4335',
      CATEGORY_UPDATES: '#fbbc04',
      CATEGORY_FORUMS: '#5f6368',
    };
    return labelColors[label] || '#5f6368';
  }
}

// Create and export a singleton instance
const gmailListenerService = new GmailListenerService();
export default gmailListenerService;
