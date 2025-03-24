import { nanoid } from 'nanoid';
import Email from '../../models/Email.js';
import emailService from '../../services/emailService.js';
import { handleError } from '../../utils/errorHandler.js';
import { fileUtils, firebaseStorage } from '../../utils/firebase.js';

// Generate a unique message ID for email tracking
const generateMessageId = (projectId, threadId) => {
  const timestamp = Date.now().toString(36);
  return `<${timestamp}.${projectId}.${threadId}@${process.env.EMAIL_DOMAIN}>`;
};

// Helper to normalize message IDs by ensuring they have angle brackets
const normalizeMessageId = (messageId) => {
  if (!messageId) return null;
  messageId = messageId.trim();
  if (!messageId.startsWith('<')) messageId = '<' + messageId;
  if (!messageId.endsWith('>')) messageId = messageId + '>';
  return messageId;
};

export const sendEmail = async (req, res) => {
  try {
    const { to, cc, bcc, subject, body, projectId, threadId, inReplyTo, references } = req.body;
    const userId = req.user.userId;
    const userEmail = req.user.email;
    const workspaceId = req.workspace._id;
    const shortEmailId = nanoid(8).replace(/[^a-zA-Z0-9]/g, '');

    // Parse arrays from form data
    const toArray = Array.isArray(to) ? to : JSON.parse(to);
    const ccArray = cc ? (Array.isArray(cc) ? cc : JSON.parse(cc)) : [];
    const bccArray = bcc ? (Array.isArray(bcc) ? bcc : JSON.parse(bcc)) : [];
    const referencesArray = references
      ? Array.isArray(references)
        ? references
        : JSON.parse(references)
      : [];

    // Normalize message IDs
    const normalizedInReplyTo = inReplyTo ? normalizeMessageId(inReplyTo) : null;
    const normalizedReferences = referencesArray
      .map((ref) => normalizeMessageId(ref))
      .filter(Boolean);

    // Handle file uploads if present
    const processedAttachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const storagePath = firebaseStorage.generatePath(workspaceId, projectId, file.originalname);
        const { url: firebaseUrl } = await firebaseStorage.uploadFile(
          file.buffer,
          storagePath,
          file.mimetype,
        );

        processedAttachments.push({
          name: file.originalname,
          size: file.size,
          type: fileUtils.getType(file.mimetype),
          url: firebaseUrl,
        });
      }
    }

    // Generate tracking email address
    const trackingAddress = `mailer+${shortEmailId}@${process.env.EMAIL_DOMAIN}`;

    // Send email using the email service with tracking headers
    const emailPayload = {
      from: `"${userEmail}" <${trackingAddress}>`,
      to: toArray.join(', '),
      cc: ccArray.length ? ccArray.join(', ') : undefined,
      bcc: bccArray.length ? bccArray.join(', ') : undefined,
      subject,
      html: body,
      attachments: processedAttachments.map((attachment) => ({
        filename: attachment.name,
        path: attachment.url,
      })),
    };

    const emailResult = await emailService.sendEmail(emailPayload);

    // Create email record in database
    const emailData = {
      projectId,
      shortEmailId,
      subject,
      body,
      to: toArray,
      cc: ccArray,
      bcc: bccArray,
      attachments: processedAttachments,
      sentBy: userId,
      status: emailResult.success ? 'sent' : 'failed',
      sentAt: new Date(),
      trackingAddress,
      from: process.env.EMAIL_FROM,
      inReplyTo: normalizedInReplyTo,
      references: normalizedReferences,
      readBy: [userId], // Mark as read by the sender by default
    };

    const email = await Email.create(emailData);

    return res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      email,
    });
  } catch (error) {
    console.error('Error sending email:', error);
    if (error instanceof SyntaxError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input format',
        error: 'Please ensure all arrays are properly formatted',
      });
    }
    return handleError(res, error, 'Failed to send email');
  }
};
