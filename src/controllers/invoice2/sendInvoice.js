import { google } from 'googleapis';
import GmailIntegration from '../../models/GmailIntegration.js';
import Invoice2 from '../../models/invoice2.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const sendInvoice = catchAsync(async (req, res, next) => {
  try {
    const { to, from, subject, message, sendCopy, attachPdf } = req.body;
    const { id } = req.params;

    // Validate required fields
    if (!to || !from || !subject || !message) {
      return next(new AppError('Missing required fields', 400));
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to) || !emailRegex.test(from)) {
      return next(new AppError('Invalid email address format', 400));
    }

    // Validate message length (matching frontend limit)
    if (message.length > 1000) {
      return next(new AppError('Message cannot exceed 1000 characters', 400));
    }

    // Validate subject length
    if (subject.length > 200) {
      return next(new AppError('Subject cannot exceed 200 characters', 400));
    }

    // Find the invoice
    const invoice = await Invoice2.findOne({
      _id: id,
      workspace: req.workspace._id,
    });

    if (!invoice) {
      return next(new AppError('No invoice found with that ID', 404));
    }

    // Find Gmail integration for this workspace
    const gmailIntegration = await GmailIntegration.findOne({
      workspace: req.workspace._id,
      email: from,
      isActive: true,
    });

    if (!gmailIntegration) {
      return next(new AppError('Gmail account not found or not active', 400));
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token: gmailIntegration.accessToken,
      refresh_token: gmailIntegration.refreshToken,
    });

    // Create Gmail client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Prepare email content with proper HTML formatting
    const emailLines = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      `<html><body>${message}</body></html>`,
    ];

    // If sendCopy is true, add CC
    if (sendCopy) {
      emailLines.splice(3, 0, `Cc: ${from}`);
    }

    // If attachPdf is true, we need to generate and attach the PDF
    if (attachPdf) {
      // TODO: Generate PDF and attach it
      // For now, we'll just send the email without attachment
      console.warn('PDF attachment requested but not implemented yet');
    }

    // Encode the email content
    const email = emailLines.join('\r\n').trim();
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    });

    // Update invoice status and add timeline entry
    invoice.status = 'sent';
    invoice.dateSent = new Date();

    // Add timeline entry
    const timelineEntry = {
      type: 'sent',
      timestamp: new Date(),
      actor: req.user.userId,
      description: `Invoice sent to ${to}`,
      metadata: {
        previousStatus: invoice.status,
        newStatus: 'sent',
        sentBy: req.user.name || req.user.email || req.user.userId,
        sentVia: 'email',
        recipient: to,
        subject,
        message,
        sendCopy,
        attachPdf,
      },
    };

    invoice.timeline = invoice.timeline || [];
    invoice.timeline.push(timelineEntry);
    await invoice.save();

    res.status(200).json({
      status: 'success',
      data: {
        invoice,
        message: 'Invoice sent successfully',
      },
    });
  } catch (error) {
    console.error('Error sending invoice:', error);

    // Handle specific Gmail API errors
    if (error.code === 401) {
      return next(
        new AppError('Gmail authentication failed. Please reconnect your Gmail account.', 401),
      );
    }
    if (error.code === 403) {
      return next(new AppError('Gmail access denied. Please check your permissions.', 403));
    }

    next(error);
  }
});
