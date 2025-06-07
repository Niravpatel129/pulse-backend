import { nanoid } from 'nanoid';
import InboxEmail from '../../models/Email/InboxEmailModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';
import { firebaseStorage } from '../../utils/firebase.js';
import { getGmailClient, sendGmailEmail } from '../../utils/gmailApi.js';

// Helper function to create email address object
const createEmailAddress = (email, name = '') => {
  const displayName = name || email.split('@')[0];
  return {
    id: Date.now(), // Using timestamp as a simple unique ID
    name: displayName,
    email: email,
    card_name: displayName,
    handle: email,
    display_name: displayName,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`,
    initials: displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase(),
    card_id: Date.now(),
    card_url: `mailto:${email}`,
    url: `mailto:${email}`,
  };
};

// Helper function to process attachments
const processAttachments = async (files, workspaceId) => {
  const processedAttachments = [];

  if (files && files.length > 0) {
    for (const file of files) {
      const storagePath = firebaseStorage.generatePath(
        workspaceId,
        'attachments',
        file.originalname,
      );
      const { url: firebaseUrl } = await firebaseStorage.uploadFile(
        file.buffer,
        storagePath,
        file.mimetype,
      );

      processedAttachments.push({
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        attachmentId: nanoid(),
        storageUrl: firebaseUrl,
        storagePath: storagePath,
        content: file.buffer, // Keep the buffer for Gmail API
      });
    }
  }

  return processedAttachments;
};

export const sendInboxEmail = catchAsync(async (req, res, next) => {
  const { to, cc, bcc, subject, body, threadId, inReplyTo, references, fromEmail } = req.body;
  const userId = req.user.userId;
  const workspaceId = req.workspace._id;

  // Parse arrays from form data
  const toArray = Array.isArray(to) ? to : JSON.parse(to);
  const ccArray = cc ? (Array.isArray(cc) ? cc : JSON.parse(cc)) : [];
  const bccArray = bcc ? (Array.isArray(bcc) ? bcc : JSON.parse(bcc)) : [];
  const referencesArray = references
    ? Array.isArray(references)
      ? references
      : JSON.parse(references)
    : [];

  // Process attachments
  const attachments = await processAttachments(req.files, workspaceId);

  // Get Gmail client
  const { client: gmailClient, integration } = await getGmailClient(workspaceId, fromEmail);
  const senderEmail = fromEmail || integration.email;

  // Send email using Gmail API
  const emailPayload = {
    to: toArray.join(', '),
    cc: ccArray.length ? ccArray.join(', ') : undefined,
    bcc: bccArray.length ? bccArray.join(', ') : undefined,
    subject,
    html: body,
    attachments,
  };

  const emailResult = await sendGmailEmail(gmailClient, emailPayload);

  if (!emailResult.success) {
    return next(new AppError('Failed to send email via Gmail', 500));
  }

  // Create email record in database
  const emailData = {
    threadId: threadId || emailResult.threadId,
    workspaceId,
    userId,
    gmailMessageId: emailResult.messageId,
    from: createEmailAddress(senderEmail),
    to: toArray.map((email) => createEmailAddress(email)),
    cc: ccArray.map((email) => createEmailAddress(email)),
    bcc: bccArray.map((email) => createEmailAddress(email)),
    subject,
    body: {
      mimeType: 'multipart/alternative',
      parts: [
        {
          mimeType: 'text/html',
          content: body,
        },
      ],
    },
    attachments: attachments.map(({ content, ...rest }) => rest), // Remove content buffer before saving
    historyId: nanoid(),
    internalDate: new Date(),
    direction: 'outbound',
    status: 'sent',
    sentAt: new Date(),
    messageReferences: [
      {
        messageId: emailResult.messageId,
        inReplyTo: inReplyTo || null,
        references: referencesArray,
        type: inReplyTo ? 'reply' : 'original',
        position: 0,
      },
    ],
    readBy: [userId], // Mark as read by the sender
  };

  const email = await InboxEmail.create(emailData);

  res.status(200).json({
    success: true,
    data: email,
  });
});
