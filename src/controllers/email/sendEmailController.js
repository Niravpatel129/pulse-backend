import Email from '../../models/Email.js';
import emailService from '../../services/emailService.js';
import { handleError } from '../../utils/errorHandler.js';
import { fileUtils, firebaseStorage } from '../../utils/firebase.js';

export const sendEmail = async (req, res) => {
  try {
    const { to, cc, bcc, subject, body, projectId } = req.body;
    const userId = req.user.userId;
    const workspaceId = req.workspace._id;

    // Parse arrays from form data
    const toArray = Array.isArray(to) ? to : JSON.parse(to);
    const ccArray = cc ? (Array.isArray(cc) ? cc : JSON.parse(cc)) : [];
    const bccArray = bcc ? (Array.isArray(bcc) ? bcc : JSON.parse(bcc)) : [];

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

        // Create a lean attachment object that matches the schema exactly
        processedAttachments.push({
          name: file.originalname,
          size: file.size,
          type: fileUtils.getType(file.mimetype),
          url: firebaseUrl,
        });
      }
    }

    // Send email using the email service
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
    };

    console.log('Creating email with data:', JSON.stringify(emailData, null, 2));
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
