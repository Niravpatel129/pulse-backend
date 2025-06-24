import Activity from '../../models/Activity.js';
import Client from '../../models/Client.js';
import Email from '../../models/Email.js';
import EmailThread from '../../models/Email/EmailThreadModel.js';
import Invoice2 from '../../models/invoice2.js';
import Note from '../../models/Note.js';
import Project from '../../models/Project.js';
import ApiResponse from '../../utils/apiResponse.js';
import AppError from '../../utils/AppError.js';

// Get client timeline
export const getClientTimeline = async (req, res, next) => {
  try {
    const { id: clientId } = req.params;
    const workspaceId = req.workspace._id;

    // Verify client exists and belongs to workspace
    const client = await Client.findOne({ _id: clientId, workspace: workspaceId });
    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    const timeline = [];

    // 1. Client creation event
    timeline.push({
      id: `client-created-${client._id}`,
      type: 'created',
      message: 'Customer Created',
      date: client.createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      timestamp: client.createdAt.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }),
      details: `Customer account was created for ${client.user.name}`,
      sortTimestamp: client.createdAt,
    });

    // 2. Client update events (using Activities if available)
    const clientActivities = await Activity.find({
      workspace: workspaceId,
      entityId: clientId,
      entityType: 'client',
    }).sort({ createdAt: -1 });

    clientActivities.forEach((activity) => {
      if (activity.action === 'updated') {
        timeline.push({
          id: `activity-${activity._id}`,
          type: 'contact_updated',
          message: 'Contact Information Updated',
          date: activity.createdAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
          timestamp: activity.createdAt.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          details: activity.description,
        });
      }
    });

    // 3. Invoice events (using Invoice2 model)
    const invoices = await Invoice2.find({
      'customer.id': clientId,
      workspace: workspaceId,
    })
      .select('_id invoiceNumber statusHistory totals status createdAt')
      .sort({ createdAt: -1 });

    // Track which invoices we've already shown a "first viewed" event for
    const firstViewedInvoices = new Set();

    invoices.forEach((invoice) => {
      // First, always add the invoice creation event using the invoice's createdAt
      timeline.push({
        id: `invoice-created-${invoice._id}`,
        type: 'invoice_created',
        message: `Invoice #${invoice.invoiceNumber} Created`,
        date: invoice.createdAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        timestamp: invoice.createdAt.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
        details: `Invoice #${invoice.invoiceNumber} for $${invoice.totals.total.toFixed(
          2,
        )} created`,
        actionData: {
          invoiceId: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          currentStatus: invoice.status,
        },
        // Store the actual Date object for more precise sorting
        sortTimestamp: invoice.createdAt,
      });

      // Then process status history for other events (excluding draft since we already added creation)
      invoice.statusHistory.forEach((historyEntry) => {
        let eventType = 'updated';
        let message = 'Invoice Updated';
        let details = historyEntry.reason || 'Invoice status updated';

        switch (historyEntry.status) {
          case 'draft':
            // Skip draft since we already added the creation event above
            return;
          case 'open':
            eventType = 'invoice_opened';
            message = `Invoice #${invoice.invoiceNumber} Opened`;
            details = `Invoice #${invoice.invoiceNumber} for $${invoice.totals.total.toFixed(
              2,
            )} opened and ready to send`;
            break;
          case 'sent':
            eventType = 'invoice_sent';
            message = `Invoice #${invoice.invoiceNumber} Sent`;
            details = `Invoice #${invoice.invoiceNumber} for $${invoice.totals.total.toFixed(
              2,
            )} sent to customer via email`;
            break;
          case 'paid':
            eventType = 'payment_received';
            message = `Payment Received - Invoice #${invoice.invoiceNumber}`;
            details = `Full payment of $${invoice.totals.total.toFixed(2)} received for invoice #${
              invoice.invoiceNumber
            }`;
            break;
          case 'partially_paid':
            eventType = 'payment_received';
            message = `Partial Payment Received - Invoice #${invoice.invoiceNumber}`;
            details = `Partial payment received for invoice #${
              invoice.invoiceNumber
            } ($${invoice.totals.total.toFixed(2)} total)`;
            break;
          case 'overdue':
            eventType = 'invoice_overdue';
            message = `Invoice #${invoice.invoiceNumber} Overdue`;
            details = `Invoice #${invoice.invoiceNumber} for $${invoice.totals.total.toFixed(
              2,
            )} is now overdue and requires follow-up`;
            break;
          case 'cancelled':
            eventType = 'invoice_cancelled';
            message = `Invoice #${invoice.invoiceNumber} Cancelled`;
            details = `Invoice #${invoice.invoiceNumber} for $${invoice.totals.total.toFixed(
              2,
            )} was cancelled`;
            break;
          case 'seen':
            // Only show the first time the customer viewed this invoice
            if (firstViewedInvoices.has(invoice._id.toString())) {
              return; // Skip subsequent views
            }
            firstViewedInvoices.add(invoice._id.toString());
            eventType = 'invoice_viewed';
            message = `Invoice #${invoice.invoiceNumber} First Viewed`;
            details = `Customer first viewed invoice #${invoice.invoiceNumber}`;
            break;
          default:
            // Skip unknown status types
            return;
        }

        timeline.push({
          id: `invoice-${invoice._id}-${historyEntry._id || historyEntry.changedAt}`,
          type: eventType,
          message,
          date: historyEntry.changedAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
          timestamp: historyEntry.changedAt.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          }),
          details,
          actionData: {
            invoiceId: invoice._id.toString(),
            invoiceNumber: invoice.invoiceNumber,
            currentStatus: invoice.status,
          },
          // Store the actual Date object for more precise sorting
          sortTimestamp: historyEntry.changedAt,
        });
      });
    });

    // 4. Email events (with improved descriptions)
    const emails = await Email.find({
      workspaceId: workspaceId,
      $or: [
        { 'from.email': client.user.email }, // Emails from client
        { 'to.email': { $elemMatch: { email: client.user.email } } }, // Emails to client
        { 'cc.email': { $elemMatch: { email: client.user.email } } }, // Emails where client is CC'd
        { 'bcc.email': { $elemMatch: { email: client.user.email } } }, // Emails where client is BCC'd
      ],
    })
      .select('_id subject from to cc bcc sentAt internalDate direction status')
      .sort({ sentAt: -1 })
      .limit(30);

    emails.forEach((email) => {
      // More accurate inbound/outbound detection
      const isFromClient = email.from?.email?.toLowerCase() === client.user.email?.toLowerCase();
      const isToClient = email.to?.some(
        (recipient) => recipient.email?.toLowerCase() === client.user.email?.toLowerCase(),
      );
      const isCcClient = email.cc?.some(
        (recipient) => recipient.email?.toLowerCase() === client.user.email?.toLowerCase(),
      );

      // Determine if this is inbound (from client) or outbound (to client)
      const isInbound = isFromClient;
      const isOutbound = isToClient || isCcClient;

      // Create more descriptive email subjects
      const emailSubject = email.subject || 'No Subject';
      const truncatedSubject =
        emailSubject.length > 50 ? emailSubject.substring(0, 50) + '...' : emailSubject;

      // Use sentAt or internalDate as fallback for the email date
      const emailDate = email.sentAt || email.internalDate || new Date();

      // Determine event type and message based on direction
      let eventType, message, details;
      if (isInbound) {
        eventType = 'email_received';
        message = 'Email Received from Customer';
        details = `Received email from ${client.user.name}: "${truncatedSubject}"`;
      } else if (isOutbound) {
        eventType = 'email_sent';
        message = 'Email Sent to Customer';
        details = `Sent email to ${client.user.name}: "${truncatedSubject}"`;
      } else {
        // Fallback for edge cases
        eventType = 'email_activity';
        message = 'Email Activity';
        details = `Email activity with ${client.user.name}: "${truncatedSubject}"`;
      }

      timeline.push({
        id: `email-${email._id}`,
        type: eventType,
        message,
        date: emailDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        timestamp: emailDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
        details,
        actionData: {
          emailId: email._id.toString(),
          subject: emailSubject,
          direction: isInbound ? 'inbound' : 'outbound',
          status: email.status,
        },
        sortTimestamp: emailDate,
      });
    });

    // 4.5. Email Thread events
    const emailThreads = await EmailThread.find({
      workspaceId: workspaceId,
      'participants.email': client.user.email,
      status: 'active',
    })
      .select(
        '_id threadId title subject participants firstMessageDate lastMessageDate messageCount',
      )
      .sort({ createdAt: -1 })
      .limit(15);

    emailThreads.forEach((thread) => {
      // Add thread creation event
      timeline.push({
        id: `thread-created-${thread._id}`,
        type: 'thread_created',
        message: 'Email Conversation Started',
        date: thread.firstMessageDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        timestamp: thread.firstMessageDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
        details: `New email conversation started: "${thread.title || thread.subject}" with ${
          thread.participants.length
        } participant(s)`,
        actionData: {
          threadId: thread._id.toString(),
          gmailThreadId: thread.threadId,
          subject: thread.subject,
          messageCount: thread.messageCount,
          participantCount: thread.participants.length,
        },
        sortTimestamp: thread.firstMessageDate,
      });

      // Add thread last activity event if different from creation
      if (
        thread.lastMessageDate &&
        thread.lastMessageDate.getTime() !== thread.firstMessageDate.getTime() &&
        thread.messageCount > 1
      ) {
        timeline.push({
          id: `thread-activity-${thread._id}`,
          type: 'thread_activity',
          message: 'Email Conversation Updated',
          date: thread.lastMessageDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
          timestamp: thread.lastMessageDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          }),
          details: `Email conversation "${thread.title || thread.subject}" updated (${
            thread.messageCount
          } messages total)`,
          actionData: {
            threadId: thread._id.toString(),
            gmailThreadId: thread.threadId,
            subject: thread.subject,
            messageCount: thread.messageCount,
            participantCount: thread.participants.length,
          },
          sortTimestamp: thread.lastMessageDate,
        });
      }
    });

    // 5. Note events (from projects where client is involved)
    // Since Project doesn't have direct client field, we'll look for projects
    // where the client email matches any collaborator's email
    const clientProjects = await Project.find({
      workspace: workspaceId,
      'collaborators.email': client.user.email,
    }).select('_id');

    if (clientProjects.length > 0) {
      const projectIds = clientProjects.map((p) => p._id);
      const notes = await Note.find({
        project: { $in: projectIds },
      })
        .sort({ createdAt: -1 })
        .limit(10);

      notes.forEach((note) => {
        timeline.push({
          id: `note-${note._id}`,
          type: 'note_added',
          message: 'Note Added',
          date: note.createdAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
          timestamp: note.createdAt.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          }),
          details: note.content.substring(0, 100) + (note.content.length > 100 ? '...' : ''),
          sortTimestamp: note.createdAt,
        });
      });
    }

    // Sort timeline by date (newest first) using precise timestamps
    timeline.sort((a, b) => {
      // Use sortTimestamp if available, otherwise fall back to parsing date/time strings
      const dateA = a.sortTimestamp || new Date(`${a.date} ${a.timestamp}`);
      const dateB = b.sortTimestamp || new Date(`${b.date} ${b.timestamp}`);
      return dateB - dateA;
    });

    res.status(200).json(new ApiResponse(200, timeline, 'Client timeline retrieved successfully'));
  } catch (error) {
    next(error);
  }
};
