import Email from '../../models/Email.js';
import emailService from '../../services/emailService.js';
import { handleError } from '../../utils/errorHandler.js';

export const sendEmail = async (req, res) => {
  try {
    const { to, cc, bcc, subject, body, projectId, attachments } = req.body;
    const userId = req.user.userId;

    // Send email using the email service
    const emailResult = await emailService.sendEmail({
      from: req.user.email,
      to: to.join(', '),
      cc: cc?.join(', '),
      bcc: bcc?.join(', '),
      subject,
      html: body,
      attachments: attachments?.map((attachment) => ({
        filename: attachment.name,
        path: attachment.url,
      })),
    });

    // Create email record in database
    const email = await Email.create({
      projectId,
      subject,
      body,
      to,
      cc,
      bcc,
      attachments,
      sentBy: userId,
      status: emailResult.success ? 'sent' : 'failed',
    });

    return res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      email,
    });
  } catch (error) {
    return handleError(res, error, 'Failed to send email');
  }
};
