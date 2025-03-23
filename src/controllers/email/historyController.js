import Email from '../../models/Email.js';
import { handleError } from '../../utils/errorHandler.js';

/**
 * Build email thread chain using replyEmailId to establish parent-child relationships
 */
const buildEmailChain = async (emails) => {
  // Create a map of email ID to email for quick lookup
  const emailMap = new Map();
  const rootEmails = [];

  // First pass: build the map
  for (const email of emails) {
    emailMap.set(email._id.toString(), {
      ...email.toObject(),
      replies: [],
    });
  }

  // Second pass: establish parent-child relationships
  for (const email of emails) {
    if (email.replyEmailId) {
      // This is a reply to another email
      const parentId =
        typeof email.replyEmailId === 'object'
          ? email.replyEmailId._id.toString()
          : email.replyEmailId.toString();

      if (emailMap.has(parentId)) {
        const parent = emailMap.get(parentId);
        parent.replies.push(emailMap.get(email._id.toString()));
      } else {
        // If parent not found in our dataset, treat as root
        rootEmails.push(emailMap.get(email._id.toString()));
      }
    } else {
      // This is a root email (not a reply)
      rootEmails.push(emailMap.get(email._id.toString()));
    }
  }

  // Group into threads
  const threads = [];
  for (const rootEmail of rootEmails) {
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

    // Find the latest message date in the thread
    const getLatestMessageDate = (email) => {
      if (email.replies.length === 0) {
        return new Date(email.sentAt).getTime();
      }

      const replyDates = email.replies.map((reply) => getLatestMessageDate(reply));
      return Math.max(new Date(email.sentAt).getTime(), ...replyDates);
    };

    threads.push({
      threadId: rootEmail.threadId || null,
      subject: rootEmail.subject,
      lastMessageAt: getLatestMessageDate(rootEmail),
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
      .populate('sentBy', 'name email')
      .populate('replyEmailId');

    // Build email threads
    const threads = await buildEmailChain(emails);

    // Paginate the threads
    const start = (page - 1) * limit;
    const paginatedThreads = threads.slice(start, start + parseInt(limit));

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
      .populate('projectId', 'name')
      .populate('replyEmailId');

    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found',
      });
    }

    // Get all related emails in the thread
    const findRelatedEmails = async (emailId, allEmails = []) => {
      // Find parent (if any)
      if (email.replyEmailId) {
        const parent = await Email.findById(email.replyEmailId).populate('sentBy', 'name email');
        if (parent && !allEmails.some((e) => e._id.toString() === parent._id.toString())) {
          allEmails.push(parent);
          await findRelatedEmails(parent._id, allEmails);
        }
      }

      // Find replies
      const replies = await Email.find({ replyEmailId: emailId }).populate('sentBy', 'name email');

      for (const reply of replies) {
        if (!allEmails.some((e) => e._id.toString() === reply._id.toString())) {
          allEmails.push(reply);
          await findRelatedEmails(reply._id, allEmails);
        }
      }

      return allEmails;
    };

    const relatedEmails = await findRelatedEmails(emailId);
    const allThreadEmails = [email, ...relatedEmails];

    const [thread] = await buildEmailChain(allThreadEmails);

    return res.status(200).json({
      success: true,
      email,
      thread,
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch email details');
  }
};
