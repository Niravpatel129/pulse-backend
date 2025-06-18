import multer from 'multer';
import asyncHandler from '../../middleware/asyncHandler.js';
import emailService from '../../services/emailService.js';
import { firebaseStorage } from '../../utils/firebase.js';

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10, // Maximum 10 files per request
  },
  fileFilter: (req, file, cb) => {
    console.log('Processing file upload:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      fieldname: file.fieldname,
    });
    cb(null, true); // Accept all file types
  },
});

// Middleware to handle file uploads
export const handleFileUploads = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          status: 'error',
          message: 'File too large. Maximum size is 10MB per file.',
          error: err.code,
        });
      }
      return res.status(400).json({
        status: 'error',
        message: `File upload error: ${err.message}`,
        error: err.code,
      });
    } else if (err) {
      console.error('File upload error:', err);
      return res.status(500).json({
        status: 'error',
        message: 'File upload failed',
        error: err.message,
      });
    }

    // Log information about uploaded files
    if (req.files && req.files.length > 0) {
      console.log(
        `[Public Inbound] Processed ${req.files.length} files:`,
        req.files.map((f) => ({
          fieldname: f.fieldname,
          originalname: f.originalname,
          size: f.size,
          mimetype: f.mimetype,
        })),
      );
    }

    next();
  });
};

/**
 * @desc    Handle inbound webhook/email callback (e.g. Maileroo, SendGrid, etc.)
 * @route   POST /api/public/inbound
 * @access  Public
 */
const inboundEmailController = asyncHandler(async (req, res) => {
  try {
    // Log the inbound payload for debugging/inspection
    console.log('[Public Inbound] Received payload:', JSON.stringify(req.body, null, 2));

    if (req.files && req.files.length > 0) {
      console.log('[Public Inbound] Received files:', req.files.length);
    }

    // Build the email subject based on payload type or default value
    const { type = 'Inbound', cmsEmail } = req.body || {};
    const subject = `New ${type} submission received`;

    // Parse additionalServices if it's a JSON string
    let additionalServices = [];
    try {
      if (req.body.additionalServices && typeof req.body.additionalServices === 'string') {
        additionalServices = JSON.parse(req.body.additionalServices);
      } else if (Array.isArray(req.body.additionalServices)) {
        additionalServices = req.body.additionalServices;
      }
    } catch (parseError) {
      console.warn('[Public Inbound] Failed to parse additionalServices:', parseError);
      additionalServices = [];
    }

    // Build a clean HTML representation of the payload
    const { selectedService, additionalNotes = '', contactForm = {} } = req.body || {};

    // Process file uploads
    const processedAttachments = [];
    if (req.files && req.files.length > 0) {
      try {
        for (const file of req.files) {
          // Generate storage path - using a generic 'public-submissions' folder
          const storagePath = firebaseStorage.generatePath(
            'public-submissions',
            `${Date.now()}-${file.originalname}`,
          );

          // Upload file to Firebase
          const { url: firebaseUrl } = await firebaseStorage.uploadFile(
            file.buffer,
            storagePath,
            file.mimetype,
          );

          processedAttachments.push({
            filename: file.originalname,
            path: firebaseUrl, // URL for email attachment
            size: file.size,
            contentType: file.mimetype,
          });

          console.log(`[Public Inbound] Uploaded file: ${file.originalname} to ${firebaseUrl}`);
        }
      } catch (uploadError) {
        console.error('[Public Inbound] Error uploading files:', uploadError);
        // Continue processing even if file upload fails
      }
    }

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
          <tr><td style="padding:8px;border:1px solid #eee;">Consent</td><td style="padding:8px;border:1px solid #eee;">${
            contactForm.consent ? 'Yes' : 'No'
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

        ${
          processedAttachments.length > 0
            ? `
        <h3 style="color:#555;margin-top:24px;">Attachments</h3>
        <ul style="list-style-type:none;padding:0;">
          ${processedAttachments
            .map(
              (att) => `
            <li style="padding:8px;border:1px solid #eee;margin-bottom:4px;">
              <strong>${att.filename}</strong> (${(att.size / 1024).toFixed(1)} KB)
              <br><a href="${att.path}" target="_blank" style="color:#007cba;">Download</a>
            </li>
          `,
            )
            .join('')}
        </ul>
        `
            : ''
        }

        <hr style="margin-top:32px;border:none;border-top:1px solid #eee;" />
        <p style="font-size:12px;color:#999;text-align:center;">
          This email was generated automatically by the Pulse public inbound webhook.
        </p>
      </div>
    `;

    // Determine recipient – fall back to a configured default if cmsEmail is absent
    const toAddress = cmsEmail || process.env.DEFAULT_CLIENT_EMAIL;

    // Prepare email options
    const emailOptions = {
      to: toAddress,
      subject,
      html: htmlBody,
    };

    // Add attachments if any were processed
    if (processedAttachments.length > 0) {
      emailOptions.attachments = processedAttachments;
    }

    await emailService.sendEmail(emailOptions);
    console.log(
      `[Public Inbound] Notification email sent to ${toAddress} with ${processedAttachments.length} attachments`,
    );

    return res.status(200).json({
      status: 'success',
      message: 'Inbound payload received and dispatched via email',
      filesProcessed: processedAttachments.length,
    });
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
