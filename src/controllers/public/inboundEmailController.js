import asyncHandler from '../../middleware/asyncHandler.js';
import emailService from '../../services/emailService.js';

/**
 * @desc    Handle inbound webhook/email callback (e.g. Maileroo, SendGrid, etc.)
 * @route   POST /api/public/inbound
 * @access  Public
 */
const inboundEmailController = asyncHandler(async (req, res) => {
  try {
    // Log the inbound payload for debugging/inspection
    console.log('[Public Inbound] Received payload:', JSON.stringify(req.body, null, 2));

    // Build the email subject based on payload type or default value
    const { type = 'Inbound', cmsEmail } = req.body || {};
    const subject = `New ${type} submission received`;

    // Build a clean HTML representation of the payload
    const {
      selectedService,
      additionalServices = [],
      additionalNotes = '',
      contactForm = {},
    } = req.body || {};

    const htmlBody = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#333;">New ${type} Submission</h2>

        <h3 style="color:#555;margin-top:24px;">Client Details</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px;border:1px solid #eee;">Name</td><td style="padding:8px;border:1px solid #eee;">${
            contactForm.name || '-'
          }</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;">Email</td><td style="padding:8px;border:1px solid #eee;">${
            contactForm.email || '-'
          }</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;">Phone</td><td style="padding:8px;border:1px solid #eee;">${
            contactForm.phone || '-'
          }</td></tr>
        </table>

        <h3 style="color:#555;margin-top:24px;">Service Details</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px;border:1px solid #eee;">Selected Service</td><td style="padding:8px;border:1px solid #eee;">${
            selectedService || '-'
          }</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;">Additional Services</td><td style="padding:8px;border:1px solid #eee;">${
            additionalServices.length ? additionalServices.join(', ') : '-'
          }</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;">Additional Notes</td><td style="padding:8px;border:1px solid #eee;">${
            additionalNotes || '-'
          }</td></tr>
        </table>

        <h3 style="color:#555;margin-top:24px;">Message</h3>
        <p style="background:#f9f9f9;padding:12px;border-radius:4px;">${
          contactForm.message ? contactForm.message.replace(/\n/g, '<br>') : '-'
        }</p>

        <hr style="margin-top:32px;border:none;border-top:1px solid #eee;" />
        <p style="font-size:12px;color:#999;text-align:center;">
          This email was generated automatically by the Pulse public inbound webhook.
        </p>
      </div>
    `;

    // Determine recipient – fall back to a configured default if cmsEmail is absent
    const toAddress = cmsEmail || process.env.DEFAULT_CLIENT_EMAIL;

    await emailService.sendEmail({
      to: toAddress,
      subject,
      html: htmlBody,
    });
    console.log(`[Public Inbound] Notification email sent to ${toAddress}`);

    return res
      .status(200)
      .json({ status: 'success', message: 'Inbound payload received and dispatched via email' });
  } catch (error) {
    console.error('[Public Inbound] Error handling payload:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to process inbound payload',
      error: error.message,
    });
  }
});

export default inboundEmailController;
