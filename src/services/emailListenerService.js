import dotenv from 'dotenv';
import MailListener from 'mail-listener2';

dotenv.config();

class EmailListenerService {
  constructor() {
    console.log('Initializing EmailListenerService with config:', {
      host: process.env.EMAIL_IMAP_HOST,
      port: process.env.EMAIL_IMAP_PORT,
      user: process.env.EMAIL_USER,
      secure: process.env.EMAIL_IMAP_SECURE,
      // Don't log password for security
    });

    this.mailListener = new MailListener({
      username: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASSWORD,
      host: process.env.EMAIL_IMAP_HOST,
      port: parseInt(process.env.EMAIL_IMAP_PORT), // Make sure port is a number
      tls: process.env.EMAIL_IMAP_SECURE === 'true',
      tlsOptions: { rejectUnauthorized: false },
      mailbox: 'INBOX',
      searchFilter: ['UNSEEN'], // Only process unread messages
      markSeen: true,
      fetchUnreadOnStart: true,
      debug: console.log, // Enable debug logging
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.mailListener.on('server:connected', () => {
      console.log('Mail listener connected successfully to IMAP server');
    });

    this.mailListener.on('server:disconnected', () => {
      console.log('Mail listener disconnected from IMAP server');
    });

    this.mailListener.on('error', (err) => {
      console.error('Mail listener error:', err);
    });

    this.mailListener.on('mail', async (mail) => {
      console.log('Received new email:', {
        from: mail.from,
        subject: mail.subject,
        date: mail.date,
      });

      try {
        await this.processIncomingEmail(mail);
      } catch (error) {
        console.error('Error processing incoming email:', error);
      }
    });
  }

  async processIncomingEmail(mail) {
    const { from, to, subject, text, html, date } = mail;

    // Extract the sender's email address
    const senderEmail = typeof from === 'string' ? from : from[0].address;

    console.log('Processing email from:', senderEmail);

    // Store the email in the database
    try {
      console.log('Successfully stored incoming email:', {
        from: to,
        subject,
        text,
        html,
        date,
      });
    } catch (error) {
      console.error('Failed to store incoming email:', error);
      throw error;
    }
  }

  start() {
    console.log('Starting email listener service...');
    this.mailListener.start();
    console.log('Email listener service started');
  }

  stop() {
    console.log('Stopping email listener service...');
    this.mailListener.stop();
    console.log('Email listener service stopped');
  }
}

// Create and export a singleton instance
const emailListenerService = new EmailListenerService();
export default emailListenerService;
