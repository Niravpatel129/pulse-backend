import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { approvalRequest } from './emailTemplates.js';

dotenv.config();

class EmailService {
  constructor() {
    // Check if we're in development environment
    // this.isDev = process.env.NODE_ENV === 'development';
    this.isDev = false;

    if (this.isDev) {
      console.log('Running in development mode - emails will be mocked');
      // Create a mock transporter for development
      this.transporter = {
        sendMail: this.mockSendMail.bind(this),
      };
    } else {
      // Real transporter for production
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_MAILEROO_HOST,
        port: process.env.EMAIL_MAILEROO_PORT,
        secure: process.env.EMAIL_MAILEROO_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_MAILEROO_USER,
          pass: process.env.EMAIL_MAILEROO_PASSWORD,
        },
      });

      // Verify connection configuration
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('SMTP connection error:', error);
        } else {
          console.log('SMTP server is ready to take our messages');
        }
      });
    }
  }

  /**
   * Add tracking pixel to HTML content if enabled
   * @param {string} html - Original HTML content
   * @param {string} messageId - Unique message ID for tracking
   * @returns {string} - HTML content with tracking pixel
   */
  addTrackingPixel(html, messageId) {
    if (process.env.EMAIL_PIXEL_TRACKING_ENABLED !== 'true') return html;

    const trackingUrl = `${process.env.EMAIL_PIXEL_TRACKING_URL}/${messageId}`;
    const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none" alt="" />`;

    return html + trackingPixel;
  }

  /**
   * Send an email using the configured transporter
   * @param {Object} options - Email options
   * @param {string} options.from - Sender email address
   * @param {string} options.to - Recipient email address
   * @param {string} options.cc - CC recipients
   * @param {string} options.bcc - BCC recipients
   * @param {string} options.subject - Email subject
   * @param {string} options.html - Email content in HTML format
   * @param {Array} options.attachments - Email attachments
   * @param {Object} options.headers - Custom email headers
   * @returns {Promise} - Resolves with the send result
   */
  async sendEmail({ from, to, cc, bcc, subject, html, attachments, headers = {} }) {
    try {
      const emailContent = {
        from: from || process.env.EMAIL_MAILEROO_FROM,
        to,
        subject,
        html: headers['Message-ID'] ? this.addTrackingPixel(html, headers['Message-ID']) : html,
        headers: {
          ...headers,
          'X-Email-Client': 'HourBlock-CRM',
        },
      };

      // Add optional fields if provided
      if (cc) emailContent.cc = cc;
      if (bcc) emailContent.bcc = bcc;
      if (attachments) emailContent.attachments = attachments;

      // If Reply-To is provided in headers, set it in the email content
      if (headers['Reply-To']) {
        emailContent.replyTo = headers['Reply-To'];
      }

      console.log('Sending email with content:', JSON.stringify(emailContent, null, 2));
      const result = await this.transporter.sendMail(emailContent);
      console.log('Email sent successfully:', result);
      return { success: true, result };
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Send an approval request email
   * @param {Object} options - Email options
   * @param {string} options.moduleName - Name of the module
   * @param {string} options.message - Email message
   * @param {string} options.senderName - Name of the sender
   * @param {string} options.recipientEmail - Recipient email address
   * @param {string} options.subject - Email subject
   * @returns {Promise} - Resolves with the send result
   */
  async sendApprovalEmail({ moduleName, message, senderName, recipientEmail, subject, link }) {
    const template = approvalRequest({ moduleName, message, link });

    return this.sendEmail({
      from: `"${senderName}" <${process.env.EMAIL_MAILEROO_FROM}>`,
      to: recipientEmail || process.env.DEFAULT_CLIENT_EMAIL,
      subject,
      html: template.html,
    });
  }
}

// Create and export a singleton instance
const emailService = new EmailService();
export default emailService;
