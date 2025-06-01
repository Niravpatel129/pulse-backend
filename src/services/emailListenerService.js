import dotenv from 'dotenv';
import MailListener from 'mail-listener2';
import { nanoid } from 'nanoid';
import Email from '../models/Email.js';
import FileItem from '../models/FileManager.js';
import User from '../models/User.js';
import { fileUtils, firebaseStorage } from '../utils/firebase.js';

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
      debug: false,
    });

    this.setupEventListeners();
  }

  /**
   * Try to find the original email using various methods
   */

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
      const { from, to, subject, text, html, date, attachments } = mail;
      console.log('🚀 mail:', mail);

      // Extract sender's email
      const fromEmail = typeof from === 'string' ? from : from[0].address;

      // Extract recipient's email and check for tracking data
      const toEmail = typeof to === 'string' ? to : to[0].address;
      const username = toEmail.split('@')[0];
      console.log('📧 Recipient address:', toEmail);
      console.log('👤 Extracted username:', username);

      // Parse the email address to extract workspaceId and parentId
      const [prefix, workspaceId, parentId] = username.split('-');

      if (!workspaceId || !parentId) {
        console.log('Invalid email format, missing workspaceId or parentId');
        return;
      }

      // Use the replyTo address if available, otherwise use the from address
      const emailOfTheUser = mail.replyTo?.[0]?.address || fromEmail;

      console.log('🚀 emailOfTheUser:', emailOfTheUser);
      // Find the user
      let user = await User.findOne({
        email: emailOfTheUser,
      });

      // If user doesn't exist, create a new one
      if (!user && emailOfTheUser) {
        user = await User.create({
          email: emailOfTheUser,
          name: fromEmail.split('@')[0] || 'Unknown User',
          password: nanoid(),
          isActivated: false,
        });
      }

      // Process attachments if any
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          try {
            // Generate unique filename
            const uniqueFilename = await this.generateUniqueFilename(
              attachment.filename,
              [], // Empty path for root level
              'files', // Default section
              workspaceId,
            );

            // Upload to Firebase
            const storagePath = firebaseStorage.generatePath(workspaceId, uniqueFilename);
            const { url, storagePath: firebasePath } = await firebaseStorage.uploadFile(
              attachment.content,
              storagePath,
              attachment.contentType,
            );

            // Create file record
            const fileDetails = fileUtils.createFileObject(
              {
                originalname: uniqueFilename,
                size: attachment.size,
                mimetype: attachment.contentType,
                buffer: attachment.content,
              },
              url,
              firebasePath,
            );

            const fileItem = await FileItem.create({
              name: uniqueFilename,
              type: 'file',
              size: attachment.size.toString(),
              section: 'files',
              path: [],
              workspaceId,
              createdBy: user?._id,
              fileDetails,
            });

            // If there's a parent, add this file to its children array
            if (parentId) {
              await FileItem.findByIdAndUpdate(parentId, {
                $push: { children: fileItem._id },
              });
            }
          } catch (error) {
            console.error('Error processing attachment:', error);
          }
        }
      }

      // Create base email data
      const emailData = {
        from: fromEmail,
        projectId: workspaceId,
        to: toEmail,
        subject,
        sentBy: user?._id,
        body: html || text,
        bodyText: text,
        sentAt: date,
        status: 'received',
        direction: 'inbound',
      };

      const email = await Email.create(emailData);
      return email;
    } catch (error) {
      console.error('Failed to process incoming email:', error);
      throw error;
    }
  }

  async generateUniqueFilename(originalName, path, section, workspaceId) {
    let counter = 1;
    let newName = originalName;
    const nameParts = originalName.split('.');
    const extension = nameParts.pop();
    const baseName = nameParts.join('.');

    while (true) {
      const existingFile = await FileItem.findOne({
        name: newName,
        type: 'file',
        path: path,
        section,
        workspaceId,
        status: 'active',
      });

      if (!existingFile) {
        return newName;
      }

      newName = `${baseName} (${counter}).${extension}`;
      counter++;
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
