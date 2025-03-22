import Email from '../../models/Email.js';
import emailService from '../../services/emailService.js';
import { handleError } from '../../utils/errorHandler.js';
import { fileUtils, firebaseStorage } from '../../utils/firebase.js';

// Base62 characters for short ID generation
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// Convert MongoDB ObjectId to short base62 ID (8 characters)
const generateShortId = (objectId) => {
  const hex = objectId.toString();
  const dec = BigInt('0x' + hex.slice(0, 12));
  let shortId = '';
  let num = dec;

  while (shortId.length < 8) {
    shortId = BASE62[Number(num % 62n)] + shortId;
    num = num / 62n;
  }

  return shortId;
};

// Generate a unique message ID for email tracking
const generateMessageId = (projectId, threadId) => {
  const timestamp = Date.now().toString(36);
  return `<${timestamp}.${projectId}.${threadId}@${process.env.EMAIL_DOMAIN}>`;
};

export const replyEmail = async (req, res) => {
  try {
    const { to, cc, bcc, subject, body, projectId, inReplyTo, references, trackingData } = req.body;
    const userId = req.user.userId;
    const workspaceId = req.workspace._id;
    const parsedTrackingData = JSON.parse(trackingData);
    console.log('🚀 parsedTrackingData:', parsedTrackingData);

    // Parse arrays from form data
    const toArray = Array.isArray(to) ? to : to ? JSON.parse(to) : [];
    const ccArray = cc ? (Array.isArray(cc) ? cc : JSON.parse(cc)) : [];
    const bccArray = bcc ? (Array.isArray(bcc) ? bcc : JSON.parse(bcc)) : [];
    const referencesArray = references
      ? Array.isArray(references)
        ? references
        : JSON.parse(references)
      : [];

    // Handle file uploads if present
    const processedAttachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const storagePath = firebaseStorage.generatePath(
            workspaceId,
            projectId,
            file.originalname,
          );

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
        } catch (fileError) {
          console.error('Error uploading file:', fileError);
          // Continue with other files even if one fails
        }
      }
    }

    // Validate required fields
    if (!toArray.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one recipient is required',
      });
    }

    if (
      !parsedTrackingData ||
      !parsedTrackingData.shortProjectId ||
      !parsedTrackingData.shortThreadId ||
      !parsedTrackingData.shortUserId
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing required tracking data',
      });
    }

    // Generate tracking email address
    const trackingAddress = `support+p${parsedTrackingData.shortProjectId}t${parsedTrackingData.shortThreadId}u${parsedTrackingData.shortUserId}@${process.env.EMAIL_DOMAIN}`;
    const messageId = generateMessageId(
      parsedTrackingData.shortProjectId,
      parsedTrackingData.shortThreadId,
    );

    // Prepare email headers
    const headers = {
      'Message-ID': messageId,
      'Reply-To': trackingAddress,
      'X-Project-ID': parsedTrackingData.shortProjectId,
      'X-Thread-ID': parsedTrackingData.shortThreadId,
      'X-User-ID': parsedTrackingData.shortUserId,
    };

    // Only add In-Reply-To and References if they exist
    if (inReplyTo) {
      headers['In-Reply-To'] = inReplyTo;
    }

    if (referencesArray.length > 0) {
      headers['References'] = referencesArray.join(' ');
    }

    // Send email using the email service with tracking headers
    const emailResult = await emailService.sendEmail({
      from: process.env.EMAIL_FROM,
      to: toArray.join(', '),
      cc: ccArray.length ? ccArray.join(', ') : undefined,
      bcc: bccArray.length ? bccArray.join(', ') : undefined,
      subject,
      html: body,
      attachments: processedAttachments.map((attachment) => ({
        filename: attachment.name,
        path: attachment.url,
      })),
      headers,
    });

    // Create email record in database
    const emailData = {
      projectId,
      subject,
      body,
      to: toArray,
      cc: ccArray,
      bcc: bccArray,
      attachments: processedAttachments,
      sentBy: userId,
      status: emailResult.success ? 'sent' : 'failed',
      sentAt: new Date(),
      messageId,
      trackingAddress,
      from: process.env.EMAIL_FROM,
      inReplyTo,
      references: referencesArray,
      trackingData,
    };

    console.log('Creating reply email with data:', JSON.stringify(emailData, null, 2));
    const email = await Email.create(emailData);

    return res.status(200).json({
      success: true,
      message: 'Reply email sent successfully',
      email,
    });
  } catch (error) {
    console.error('Error sending reply email:', error);
    if (error instanceof SyntaxError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input format',
        error: 'Please ensure all arrays are properly formatted',
      });
    }
    return handleError(res, error, 'Failed to send reply email');
  }
};
