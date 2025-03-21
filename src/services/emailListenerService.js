import dotenv from 'dotenv';
import MailListener from 'mail-listener2';
import Email from '../models/Email.js';

dotenv.config();

class EmailListenerService {
  constructor() {
    this.mailListener = new MailListener({
      username: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASSWORD,
      host: process.env.EMAIL_IMAP_HOST,
      port: parseInt(process.env.EMAIL_IMAP_PORT), // Make sure port is a number
      tls: process.env.EMAIL_IMAP_SECURE === 'true',
      tlsOptions: { rejectUnauthorized: false },
      mailbox: process.env.EMAIL_IMAP_FOLDER || 'INBOX',
      searchFilter: ['UNSEEN'], // Only process unread messages
      markSeen: true,
      fetchUnreadOnStart: true,
      debug: process.env.NODE_ENV === 'development' ? console.log : false,
    });

    this.setupEventListeners();
  }

  /**
   * Extract tracking data from email address
   * Format: support+p{projectId}t{threadId}u{userId}@domain.com
   */
  extractTrackingData(email) {
    try {
      // Check if email is a string and contains the tracking format
      if (!email || typeof email !== 'string') return null;

      // Try to match the concatenated format with implicit separators
      const match = email.match(/support\+p([a-zA-Z0-9]+)t([a-zA-Z0-9]+)u([a-zA-Z0-9]+)@/);
      if (!match) return null;

      // Extract the IDs
      return {
        shortProjectId: match[1], // WQU0IfIu
        shortThreadId: match[2], // WQWcICGh
        shortUserId: match[3], // WOunw0bl
      };
    } catch (error) {
      console.error('Error extracting tracking data:', error);
      return null;
    }
  }

  /**
   * Store email headers as a Map
   */
  processHeaders(mail) {
    const headers = new Map();
    if (!mail.headers) return headers;

    // Store important headers
    const importantHeaders = [
      'message-id',
      'in-reply-to',
      'references',
      'x-project-id',
      'x-thread-id',
      'x-user-id',
    ];

    for (const header of importantHeaders) {
      if (mail.headers[header]) {
        headers.set(header, mail.headers[header]);
      }
    }

    return headers;
  }

  /**
   * Try to find the original email using various methods
   */
  async findOriginalEmail(mail, trackingData) {
    console.log('Finding original email with:', {
      trackingData,
      inReplyTo: mail.headers['in-reply-to'],
      references: mail.headers.references,
    });

    // First try using tracking data if available
    if (trackingData) {
      // Try finding by tracking data
      console.log('Trying tracking data match:', {
        projectId: trackingData.shortProjectId,
        threadId: trackingData.shortThreadId,
      });

      const byTracking = await Email.findOne({
        'trackingData.shortProjectId': trackingData.shortProjectId,
        'trackingData.shortThreadId': trackingData.shortThreadId,
      });
      if (byTracking) {
        console.log('Found by tracking data');
        return byTracking;
      }

      // Try finding by legacy tracking data format
      console.log('Trying legacy tracking data match');
      const byLegacyTracking = await Email.findOne({
        'trackingData.shortProjectId': trackingData.shortProjectId,
        'trackingData.shortThreadId': { $regex: `^${trackingData.shortThreadId}` },
      });
      if (byLegacyTracking) {
        console.log('Found by legacy tracking data');
        return byLegacyTracking;
      }

      // Try finding by message ID pattern
      if (mail.headers['in-reply-to']) {
        // Extract project and thread IDs from in-reply-to
        // Format: m8i8js8w.WQU0IfIu.WQWcICGh@hourblock.com
        const parts = mail.headers['in-reply-to'].split('.');
        if (parts.length >= 3) {
          const [, projectId, threadId] = parts;
          console.log('Trying message ID pattern match:', { projectId, threadId });

          const byMessagePattern = await Email.findOne({
            messageId: { $regex: `${projectId}.${threadId}@` },
          });
          if (byMessagePattern) {
            console.log('Found by message ID pattern');
            return byMessagePattern;
          }
        }
      }
    }

    // Try using In-Reply-To header
    if (mail.headers['in-reply-to']) {
      console.log('Trying in-reply-to match:', mail.headers['in-reply-to']);

      const byReplyTo = await Email.findOne({
        messageId: mail.headers['in-reply-to'],
      });
      if (byReplyTo) {
        console.log('Found by in-reply-to');
        return byReplyTo;
      }
    }

    // Try using References header
    if (mail.headers.references) {
      const references =
        typeof mail.headers.references === 'string'
          ? mail.headers.references.split(/\s+/)
          : mail.headers.references;

      console.log('Trying references match:', references);

      const byReference = await Email.findOne({
        messageId: { $in: references },
      });
      if (byReference) {
        console.log('Found by references');
        return byReference;
      }
    }

    console.log('No match found');
    return null;
  }

  setupEventListeners() {
    this.mailListener.on('server:connected', () => {
      console.log('Mail listener connected successfully to IMAP server');
    });

    this.mailListener.on('server:disconnected', () => {
      console.log('Mail listener disconnected from IMAP server');
      // Try to reconnect after a delay
      setTimeout(() => {
        console.log('Attempting to reconnect...');
        this.start();
      }, 10000);
    });

    this.mailListener.on('error', (err) => {
      console.error('Mail listener error:', err);
    });

    this.mailListener.on('mail', async (mail) => {
      try {
        await this.processIncomingEmail(mail);
      } catch (error) {
        console.error('Error processing incoming email:', error);
      }
    });
  }

  async processIncomingEmail(mail) {
    try {
      const { from, to, subject, text, html, date, headers } = mail;

      // Extract sender's email
      const fromEmail = typeof from === 'string' ? from : from[0].address;

      // Extract recipient's email and check for tracking data
      const toEmail = typeof to === 'string' ? to : to[0].address;
      const trackingData = this.extractTrackingData(toEmail);

      // Process headers
      const processedHeaders = this.processHeaders(mail);

      // Try to find the original email
      const originalEmail = await this.findOriginalEmail(mail, trackingData);

      // Create base email data
      const emailData = {
        from: fromEmail,
        to: Array.isArray(to) ? to.map((t) => t.address) : [toEmail],
        subject,
        body: html || text,
        bodyText: text,
        sentAt: date,
        status: 'received',
        direction: 'inbound',
        headers: processedHeaders,
        messageId: headers['message-id'],
        inReplyTo: headers['in-reply-to'],
        references: headers['references'] ? headers['references'].split(/\s+/) : [],
        unmatched: !originalEmail, // Mark as unmatched if no original email found
      };

      // Always store tracking data if we have it
      if (trackingData) {
        emailData.trackingData = trackingData;
      }

      // If we found the original email, add project and thread info
      if (originalEmail) {
        emailData.projectId = originalEmail.projectId;
        emailData.threadId = originalEmail.threadId;
      }

      // Store the email
      const email = await Email.create(emailData);

      // Move to processed folder if configured
      if (process.env.EMAIL_IMAP_PROCESSED_FOLDER) {
        // Implementation for moving to processed folder would go here
        // Depends on the mail-listener2 capabilities
      }
    } catch (error) {
      console.error('Failed to process incoming email:', error);
      throw error;
    }
  }

  start() {
    this.mailListener.start();
  }

  stop() {
    this.mailListener.stop();
  }
}

// Create and export a singleton instance
const emailListenerService = new EmailListenerService();
export default emailListenerService;
