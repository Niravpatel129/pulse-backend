import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

class EmailService {
  constructor() {
    // Check if we're in development environment
    this.isDev = process.env.NODE_ENV === 'development';

    if (this.isDev) {
      console.log('Running in development mode - emails will be mocked');
      // Create a mock transporter for development
      this.transporter = {
        sendMail: this.mockSendMail.bind(this),
      };
    } else {
      // Real transporter for production
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
    }
  }

  /**
   * Mock email sending for development environment
   * @param {Object} emailContent - Email content
   * @returns {Promise} - Resolves with mock result
   */
  async mockSendMail(emailContent) {
    console.log('MOCK EMAIL SENT:');
    console.log('----------------------------------');
    console.log(`From: ${emailContent.from}`);
    console.log(`To: ${emailContent.to}`);
    console.log(`Subject: ${emailContent.subject}`);
    console.log('Content:');
    console.log(emailContent.html);
    console.log('----------------------------------');

    return {
      messageId: `mock-email-${Date.now()}@localhost`,
      response: 'Mock email sent successfully',
    };
  }

  /**
   * Send an email using the configured transporter
   * @param {Object} options - Email options
   * @param {string} options.from - Sender email address
   * @param {string} options.to - Recipient email address
   * @param {string} options.subject - Email subject
   * @param {string} options.html - Email content in HTML format
   * @returns {Promise} - Resolves with the send result
   */
  async sendEmail({ from, to, subject, html }) {
    try {
      const emailContent = {
        from: from || process.env.EMAIL_FROM,
        to,
        subject,
        html,
      };

      const result = await this.transporter.sendMail(emailContent);
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
   * @param {boolean} options.requestApproval - Whether to include approval request
   * @returns {Promise} - Resolves with the send result
   */
  async sendApprovalEmail({
    moduleName,
    message,
    senderName,
    recipientEmail,
    subject,
    requestApproval = false,
  }) {
    const html = `
      <div>
        <h2>Module: ${moduleName}</h2>
        <p>${message}</p>
        ${requestApproval ? '<p>Please review and approve this module.</p>' : ''}
        <p>Sent by: ${senderName}</p>
      </div>
    `;

    return this.sendEmail({
      from: `"${senderName}" <${process.env.EMAIL_FROM}>`,
      to: recipientEmail || process.env.DEFAULT_CLIENT_EMAIL,
      subject,
      html,
    });
  }
}

// Create and export a singleton instance
const emailService = new EmailService();
export default emailService;
