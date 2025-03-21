import Email from '../../models/Email.js';
import { handleError } from '../../utils/errorHandler.js';

/**
 * Build email thread chain using standard email headers
 */
const buildEmailChain = async (emails) => {
  // Create a map of messageId to email for quick lookup
  const emailMap = new Map();
  const rootEmails = new Set();

  // First pass: build the map and identify root emails
  for (const email of emails) {
    emailMap.set(email.messageId, {
      ...email.toObject(),
      replies: [],
    });

    // If no inReplyTo, it's a root email
    if (!email.inReplyTo) {
      rootEmails.add(email.messageId);
    }
  }

  // Second pass: build reply chains
  for (const email of emails) {
    if (email.inReplyTo && emailMap.has(email.inReplyTo)) {
      const parent = emailMap.get(email.inReplyTo);
      parent.replies.push(emailMap.get(email.messageId));
      // If this was marked as root, remove it since it's a reply
      rootEmails.delete(email.messageId);
    }
  }

  // Group into threads
  const threads = [];
  for (const rootId of rootEmails) {
    const rootEmail = emailMap.get(rootId);

    // Sort replies by date recursively
    const sortReplies = (email) => {
      email.replies.sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));
      for (const reply of email.replies) {
        sortReplies(reply);
      }
    };

    sortReplies(rootEmail);

    // Count all emails in this thread
    const countEmails = (email) => {
      return 1 + email.replies.reduce((sum, reply) => sum + countEmails(reply), 0);
    };

    // Get all participants in this thread
    const getParticipants = (email) => {
      const participants = new Set([...email.to, email.from]);
      for (const reply of email.replies) {
        const replyParticipants = getParticipants(reply);
        for (const participant of replyParticipants) {
          participants.add(participant);
        }
      }
      return participants;
    };

    threads.push({
      threadId: rootEmail.threadId || null,
      subject: rootEmail.subject,
      lastMessageAt: Math.max(
        new Date(rootEmail.sentAt).getTime(),
        ...Array.from(emailMap.values())
          .filter((e) => e.inReplyTo === rootId)
          .map((e) => new Date(e.sentAt).getTime()),
      ),
      messageCount: countEmails(rootEmail),
      participants: Array.from(getParticipants(rootEmail)),
      messages: [rootEmail],
    });
  }

  // Sort threads by most recent message
  threads.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

  return threads;
};

export const getEmailHistory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Get all emails for the project
    const emails = await Email.find({ projectId })
      .sort({ sentAt: -1 })
      .populate('sentBy', 'name email');

    // Build email threads
    const threads = await buildEmailChain(emails);

    // Paginate the threads
    const start = (page - 1) * limit;
    const paginatedThreads = threads.slice(start, start + limit);

    return res.status(200).json({
      success: true,
      threads: paginatedThreads,
      pagination: {
        total: threads.length,
        page: parseInt(page),
        pages: Math.ceil(threads.length / limit),
      },
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch email history');
  }
};

export const getEmailDetails = async (req, res) => {
  try {
    const { emailId } = req.params;
    const email = await Email.findById(emailId)
      .populate('sentBy', 'name email')
      .populate('projectId', 'name');

    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found',
      });
    }

    // Get all related emails (parent and replies)
    const relatedEmails = await Email.find({
      $or: [{ messageId: email.inReplyTo }, { inReplyTo: email.messageId }],
    }).populate('sentBy', 'name email');

    const [thread] = await buildEmailChain([...relatedEmails, email]);

    return res.status(200).json({
      success: true,
      email,
      thread,
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch email details');
  }
};
