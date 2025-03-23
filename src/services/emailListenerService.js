import dotenv from 'dotenv';
import MailListener from 'mail-listener2';
import Email from '../models/Email.js';
import User from '../models/User.js';

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
      const { from, to, subject, text, html, date, headers, replyTo } = mail;
      console.log('🚀 mail:', mail);

      // Log raw headers for debugging
      console.log('Raw headers:', headers);

      // Extract sender's email
      const fromEmail = typeof from === 'string' ? from : from[0].address;

      // Extract recipient's email and check for tracking data
      const toEmail = typeof to === 'string' ? to : to[0].address;
      // based on the trackerAddress example, i need to extract out the shortEmailId
      const shortEmailId = toEmail.split('@')[0].split('+')[1];
      console.log('🚀 shortEmailId:', shortEmailId);

      //   find the email Id from shortEmailId
      const checkEmail = await Email.findOne({ shortEmailId });
      console.log('🚀 checkEmail from shortEmailId:', checkEmail ? 'found' : 'not found');

      // Instead of looking for replyTo which doesn't exist in your JSON,
      // use the sender's email address (fromEmail)
      const emailOfTheUser = fromEmail;

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
          isActivated: false,
        });
        console.log('Created new user for email:', emailOfTheUser);
      }
      console.log('🚀 user:', user);

      // Create base email data
      const emailData = {
        from: fromEmail,
        projectId: checkEmail?.projectId,
        to: Array.isArray(to) ? to.map((t) => t.address) : [toEmail],
        subject,
        sentBy: user?._id, // Added optional chaining in case user is null
        body: html || text,
        bodyText: text,
        sentAt: date,
        status: 'received',
        direction: 'inbound',
        replyEmailId: checkEmail?._id,
      };

      const email = await Email.create(emailData);

      return email;
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
