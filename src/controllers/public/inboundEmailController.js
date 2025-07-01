import multer from 'multer';
import asyncHandler from '../../middleware/asyncHandler.js';
import Activity from '../../models/Activity.js';
import Client from '../../models/Client.js';
import GmailIntegration from '../../models/GmailIntegration.js';
import Workspace from '../../models/Workspace.js';
import emailService from '../../services/emailService.js';
import { firebaseStorage } from '../../utils/firebase.js';
import { sendGmailEmail } from '../../utils/gmailApi.js';

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

    // Get workspace from workspaceId in request body
    let workspace = null;
    const { workspaceId } = req.body || {};

    if (workspaceId) {
      try {
        workspace = await Workspace.findOne({
          _id: workspaceId,
          isActive: true,
        });

        if (workspace) {
          console.log(`[Public Inbound] Found workspace: ${workspace.name} (${workspace._id})`);
        } else {
          console.log(`[Public Inbound] Workspace not found: ${workspaceId}`);
        }
      } catch (workspaceError) {
        console.error('[Public Inbound] Error finding workspace:', workspaceError.message);
      }
    } else {
      console.log('[Public Inbound] No workspaceId provided in request');
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
    const {
      selectedService,
      additionalNotes = '',
      contactForm = {},
      callbackSchedule = {},
    } = req.body || {};

    let standardFields = {};
    let dynamicFields = {};
    let isCallbackForm = type === 'callback' && Object.keys(callbackSchedule).length > 0;

    if (isCallbackForm) {
      // Handle callback form submission
      standardFields = {
        name: callbackSchedule.name || '',
        phone: callbackSchedule.phone || '',
        notes: callbackSchedule.notes || '',
        date: callbackSchedule.date || '',
        time: callbackSchedule.time || '',
        isASAP: callbackSchedule.isASAP || false,
      };

      // Extract dynamic fields from callback schedule (excluding standard fields)
      const excludedCallbackFields = ['name', 'phone', 'notes', 'date', 'time', 'isASAP'];
      Object.keys(callbackSchedule).forEach((key) => {
        if (
          !excludedCallbackFields.includes(key) &&
          callbackSchedule[key] !== undefined &&
          callbackSchedule[key] !== ''
        ) {
          dynamicFields[key] = callbackSchedule[key];
        }
      });
    } else {
      // Handle contact form submission
      standardFields = {
        name: contactForm.name || '',
        email: contactForm.email || '',
        phone: contactForm.phone || '',
        message: contactForm.message || '',
        consent: contactForm.consent || false,
      };

      // Extract all dynamic fields from contact form (excluding standard fields and files)
      const excludedFields = ['name', 'email', 'phone', 'message', 'consent', 'files'];
      Object.keys(contactForm).forEach((key) => {
        if (
          !excludedFields.includes(key) &&
          contactForm[key] !== undefined &&
          contactForm[key] !== ''
        ) {
          dynamicFields[key] = contactForm[key];
        }
      });
    }

    // Create client if workspace context is available and required data exists
    let createdClient = null;
    const hasRequiredClientData = isCallbackForm
      ? workspace && standardFields.name && standardFields.phone
      : workspace && standardFields.name && standardFields.email;

    if (hasRequiredClientData) {
      try {
        // For callback forms, check by phone; for contact forms, check by email
        const clientQuery = isCallbackForm
          ? { workspace: workspace._id, phone: standardFields.phone }
          : { workspace: workspace._id, 'user.email': standardFields.email };

        const existingClient = await Client.findOne(clientQuery);

        if (!existingClient) {
          // Prepare internal notes with all form data
          const formDataSummary = [
            `Created from ${type} form submission.`,
            `Selected Service: ${selectedService || 'N/A'}`,
            `Additional Services: ${additionalServices.join(', ') || 'None'}`,
            `Additional Notes: ${additionalNotes || 'None'}`,
          ];

          if (isCallbackForm) {
            formDataSummary.push(`Callback Type: ${standardFields.isASAP ? 'ASAP' : 'Scheduled'}`);
            if (!standardFields.isASAP && standardFields.date && standardFields.time) {
              formDataSummary.push(
                `Preferred Date/Time: ${standardFields.date} at ${standardFields.time}`,
              );
            }
            if (standardFields.notes) {
              formDataSummary.push(`Notes: ${standardFields.notes}`);
            }
          } else {
            formDataSummary.push(`Consent: ${standardFields.consent ? 'Yes' : 'No'}`);
          }

          // Add dynamic fields to internal notes
          if (Object.keys(dynamicFields).length > 0) {
            formDataSummary.push('');
            formDataSummary.push('Additional Form Data:');
            Object.entries(dynamicFields).forEach(([key, value]) => {
              const fieldLabel =
                key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
              formDataSummary.push(
                `${fieldLabel}: ${Array.isArray(value) ? value.join(', ') : value}`,
              );
            });
          }

          // Create new client with appropriate data based on form type
          const clientData = {
            workspace: workspace._id,
            phone: standardFields.phone || '',
            internalNotes: formDataSummary.join('\n'),
            customFields: {
              selectedService,
              additionalServices,
              additionalNotes,
              formSubmissionType: type,
              submissionDate: new Date().toISOString(),
              ...dynamicFields, // Include all dynamic fields
            },
          };

          if (isCallbackForm) {
            // For callback forms, we might not have email, so create a basic client
            clientData.user = {
              name: standardFields.name,
              email: '', // Empty email for callback-only clients
            };
            clientData.contact = {
              firstName: standardFields.name.split(' ')[0] || '',
              lastName: standardFields.name.split(' ').slice(1).join(' ') || '',
            };
            clientData.customFields.callbackPreferences = {
              isASAP: standardFields.isASAP,
              preferredDate: standardFields.date,
              preferredTime: standardFields.time,
              notes: standardFields.notes,
            };
          } else {
            // For contact forms, we have email
            clientData.user = {
              name: standardFields.name,
              email: standardFields.email,
            };
            clientData.contact = {
              firstName: standardFields.name.split(' ')[0] || '',
              lastName: standardFields.name.split(' ').slice(1).join(' ') || '',
            };
          }

          createdClient = await Client.create(clientData);

          // Create activity for client creation
          await Activity.create({
            user: null, // No authenticated user for public submissions
            workspace: workspace._id,
            type: 'client',
            action: 'created',
            description: `Client "${createdClient.user.name}" was created from ${type} form submission`,
            entityId: createdClient._id,
            entityType: 'client',
            metadata: {
              clientName: createdClient.user.name,
              clientEmail: createdClient.user.email,
              source: 'form_submission',
              formType: type,
            },
          });

          console.log(
            `[Public Inbound] Created new client: ${createdClient.user.name} (${createdClient.user.email})`,
          );
        } else {
          console.log(`[Public Inbound] Client already exists: ${existingClient.user.email}`);
          createdClient = existingClient;
        }
      } catch (clientError) {
        console.error('[Public Inbound] Error creating client:', clientError);
        // Continue with email sending even if client creation fails
      }
    } else {
      console.log(
        '[Public Inbound] Skipping client creation - missing workspace context or required data',
      );
    }

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

        ${
          isCallbackForm
            ? `
        <h3 style="color:#555;margin-top:24px;">Callback Request Details</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px;border:1px solid #eee;">Name</td><td style="padding:8px;border:1px solid #eee;">${
            standardFields.name || '-'
          }</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;">Phone</td><td style="padding:8px;border:1px solid #eee;">${
            standardFields.phone || '-'
          }</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;">Timing</td><td style="padding:8px;border:1px solid #eee;">${
            standardFields.isASAP ? 'ASAP' : 'Scheduled'
          }</td></tr>
          ${
            !standardFields.isASAP && standardFields.date
              ? `
          <tr><td style="padding:8px;border:1px solid #eee;">Preferred Date</td><td style="padding:8px;border:1px solid #eee;">${standardFields.date}</td></tr>
          `
              : ''
          }
          ${
            !standardFields.isASAP && standardFields.time
              ? `
          <tr><td style="padding:8px;border:1px solid #eee;">Preferred Time</td><td style="padding:8px;border:1px solid #eee;">${standardFields.time}</td></tr>
          `
              : ''
          }
        </table>

        ${
          standardFields.notes
            ? `
        <h3 style="color:#555;margin-top:24px;">Notes</h3>
        <p style="background:#f9f9f9;padding:12px;border-radius:4px;">${standardFields.notes.replace(
          /\n/g,
          '<br>',
        )}</p>
        `
            : ''
        }
        `
            : `
        <h3 style="color:#555;margin-top:24px;">Client Details</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px;border:1px solid #eee;">Name</td><td style="padding:8px;border:1px solid #eee;">${
            standardFields.name || '-'
          }</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;">Email</td><td style="padding:8px;border:1px solid #eee;">${
            standardFields.email || '-'
          }</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;">Phone</td><td style="padding:8px;border:1px solid #eee;">${
            standardFields.phone || '-'
          }</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;">Consent</td><td style="padding:8px;border:1px solid #eee;">${
            standardFields.consent ? 'Yes' : 'No'
          }</td></tr>
        </table>

        ${
          standardFields.message
            ? `
        <h3 style="color:#555;margin-top:24px;">Message</h3>
        <p style="background:#f9f9f9;padding:12px;border-radius:4px;">${standardFields.message.replace(
          /\n/g,
          '<br>',
        )}</p>
        `
            : ''
        }
        `
        }

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

        ${
          Object.keys(dynamicFields).length > 0
            ? `
        <h3 style="color:#555;margin-top:24px;">Additional Information</h3>
        <table style="width:100%;border-collapse:collapse;">
          ${Object.entries(dynamicFields)
            .map(([key, value]) => {
              const fieldLabel =
                key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
              let displayValue = '-';

              if (value !== undefined && value !== null && value !== '') {
                if (Array.isArray(value)) {
                  displayValue = value.join(', ');
                } else if (typeof value === 'string' && value.includes('\n')) {
                  displayValue = value.replace(/\n/g, '<br>');
                } else {
                  displayValue = String(value);
                }
              }

              return `<tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;width:30%;">${fieldLabel}</td><td style="padding:8px;border:1px solid #eee;">${displayValue}</td></tr>`;
            })
            .join('')}
        </table>
        `
            : ''
        }

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

        ${
          createdClient
            ? `
        <h3 style="color:#555;margin-top:24px;">Client Created</h3>
        <p style="background:#e6f3ff;padding:12px;border-radius:4px;color:#0066cc;">
          ✅ New client "${createdClient.user.name}" has been automatically created in your workspace.
        </p>
        `
            : ''
        }

        <hr style="margin-top:32px;border:none;border-top:1px solid #eee;" />
        <p style="font-size:12px;color:#999;text-align:center;">
          This email was generated automatically.
        </p>
      </div>
    `;

    // Determine recipient – fall back to a configured default if cmsEmail is absent
    const toAddress = cmsEmail || process.env.DEFAULT_CLIENT_EMAIL;

    // Check for Gmail integration and send email accordingly
    let emailSent = false;
    let sentViaGmail = false;
    const testingEmail = 'mrmapletv@gmail.com';

    if (workspace && toAddress) {
      try {
        // Look for Gmail integration for this workspace
        const gmailIntegration = await GmailIntegration.findOne({
          workspace: workspace._id,
          email: toAddress,
          isActive: true,
        });

        if (!gmailIntegration) {
          // Try to find primary Gmail integration if specific email not found
          const primaryGmailIntegration = await GmailIntegration.findOne({
            workspace: workspace._id,
            isPrimary: true,
            isActive: true,
          });

          if (primaryGmailIntegration) {
            console.log(
              `[Public Inbound] Using primary Gmail integration: ${primaryGmailIntegration.email}`,
            );

            // Check if token needs refresh
            if (new Date() >= primaryGmailIntegration.tokenExpiry) {
              console.warn(
                '[Public Inbound] Gmail token expired, falling back to default email service',
              );
            } else {
              // Create Gmail client
              const { google } = await import('googleapis');
              const oauth2Client = new google.auth.OAuth2();
              oauth2Client.setCredentials({ access_token: primaryGmailIntegration.accessToken });
              const gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });

              // Prepare Gmail email payload (skip attachments for now)
              const gmailEmailPayload = {
                to: toAddress,
                subject,
                html: htmlBody,
                // Note: Attachments are skipped for Gmail integration in public forms
                // They will be included only if we fall back to the default email service
                attachments: [],
              };

              // Send via Gmail
              const gmailResult = await sendGmailEmail(
                gmailClient,
                gmailEmailPayload,
                primaryGmailIntegration,
              );

              if (gmailResult.success) {
                emailSent = true;
                sentViaGmail = true;
                console.log(
                  `[Public Inbound] Email sent via Gmail: ${primaryGmailIntegration.email}`,
                );
              } else {
                console.error('[Public Inbound] Gmail send failed:', gmailResult.error);
              }
            }
          }
        } else {
          console.log(`[Public Inbound] Found Gmail integration for: ${gmailIntegration.email}`);

          // Check if token needs refresh
          if (new Date() >= gmailIntegration.tokenExpiry) {
            console.warn(
              '[Public Inbound] Gmail token expired, falling back to default email service',
            );
          } else {
            // Create Gmail client
            const { google } = await import('googleapis');
            const oauth2Client = new google.auth.OAuth2();
            oauth2Client.setCredentials({ access_token: gmailIntegration.accessToken });
            const gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });

            // Prepare Gmail email payload (skip attachments for now)
            const gmailEmailPayload = {
              to: toAddress,
              subject,
              html: htmlBody,
              // Note: Attachments are skipped for Gmail integration in public forms
              // They will be included only if we fall back to the default email service
              attachments: [],
            };

            // Send via Gmail
            const gmailResult = await sendGmailEmail(
              gmailClient,
              gmailEmailPayload,
              gmailIntegration,
            );

            if (gmailResult.success) {
              emailSent = true;
              sentViaGmail = true;
              console.log(`[Public Inbound] Email sent via Gmail: ${gmailIntegration.email}`);
            } else {
              console.error('[Public Inbound] Gmail send failed:', gmailResult.error);
            }
          }
        }
      } catch (gmailError) {
        console.error('[Public Inbound] Gmail integration error:', gmailError);
      }
    }

    // Fallback to default email service if Gmail didn't work OR if we have attachments and used Gmail
    const needsDefaultService = !emailSent || (sentViaGmail && processedAttachments.length > 0);

    if (needsDefaultService) {
      try {
        // Prepare email options for default service
        const emailOptions = {
          to: toAddress,
          subject: sentViaGmail ? `[Attachments] ${subject}` : subject,
          html: sentViaGmail
            ? `<p><strong>Note:</strong> This email contains attachments for the form submission sent separately.</p><hr/>${htmlBody}`
            : htmlBody,
        };

        // Add attachments if any were processed
        if (processedAttachments.length > 0) {
          emailOptions.attachments = processedAttachments;
        }

        // Only send if we have attachments to send OR if no email was sent yet
        if (!emailSent || processedAttachments.length > 0) {
          await emailService.sendEmail(emailOptions);
          emailSent = true;

          if (sentViaGmail && processedAttachments.length > 0) {
            console.log(`[Public Inbound] Attachments sent via default service to ${toAddress}`);
          } else {
            console.log(`[Public Inbound] Email sent via default service to ${toAddress}`);
          }
        }
      } catch (defaultEmailError) {
        console.error('[Public Inbound] Default email service failed:', defaultEmailError);
      }
    }

    if (!emailSent) {
      console.error('[Public Inbound] All email sending methods failed');
    }

    // Send clone email manually from hourblock domain to testing email
    try {
      const cloneEmailOptions = {
        from: `"HourBlock Notifications" <notifications@hourblock.com>`,
        to: testingEmail,
        subject: `[Clone] ${subject}`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#f0f9ff;padding:16px;border-radius:4px;margin-bottom:20px;">
              <h3 style="color:#0369a1;margin:0;">📧 Clone Email from HourBlock</h3>
              <p style="margin:8px 0 0 0;color:#0369a1;font-size:14px;">
                This is a clone of the inbound form submission email sent to: <strong>${toAddress}</strong>
              </p>
            </div>
            ${htmlBody}
          </div>
        `,
      };

      // Add attachments if any were processed
      if (processedAttachments.length > 0) {
        cloneEmailOptions.attachments = processedAttachments;
      }

      await emailService.sendEmail(cloneEmailOptions);
      console.log(`[Public Inbound] Clone email sent from HourBlock domain to ${testingEmail}`);
    } catch (cloneEmailError) {
      console.error('[Public Inbound] Failed to send clone email:', cloneEmailError);
    }

    const attachmentMethod =
      sentViaGmail && processedAttachments.length > 0
        ? 'Gmail (content) + default service (attachments)'
        : sentViaGmail
        ? 'Gmail'
        : 'default service';

    console.log(
      `[Public Inbound] Notification email sent to ${toAddress} with ${processedAttachments.length} attachments via ${attachmentMethod}`,
    );

    return res.status(200).json({
      status: 'success',
      message: 'Inbound payload received and dispatched via email',
      filesProcessed: processedAttachments.length,
      clientCreated: createdClient ? true : false,
      clientId: createdClient ? createdClient._id : null,
      sentViaGmail,
      emailSent,
      submissionType: type,
      isDynamicForm: Object.keys(dynamicFields).length > 0,
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
