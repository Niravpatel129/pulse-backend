import Activity from '../../models/Activity.js';
import Client from '../../models/Client.js';
import Email from '../../models/Email.js';
import Invoice from '../../models/invoiceModel.js';
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
        hour12: true,
      }),
      details: `Customer account was created for ${client.user.name}`,
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

    // 3. Invoice events
    const invoices = await Invoice.find({ client: clientId, workspace: workspaceId })
      .select('_id invoiceNumber timeline total currency status')
      .sort({ createdAt: -1 });

    invoices.forEach((invoice) => {
      invoice.timeline.forEach((timelineEntry) => {
        let eventType = 'updated';
        let message = 'Invoice Updated';
        let details = timelineEntry.description;

        switch (timelineEntry.type) {
          case 'created':
            eventType = 'invoice_sent';
            message = `Invoice #${invoice.invoiceNumber} Created`;
            details = `Invoice for $${invoice.total.toFixed(2)} created`;
            break;
          case 'sent':
            eventType = 'invoice_sent';
            message = `Invoice #${invoice.invoiceNumber} Sent`;
            details = `Invoice for $${invoice.total.toFixed(2)} sent via email`;
            break;
          case 'payment_succeeded':
            eventType = 'payment_received';
            message = 'Payment Received';
            details = `Payment of $${invoice.total.toFixed(2)} received`;
            break;
          case 'viewed':
            // Skip view events for timeline simplicity
            return;
        }

        timeline.push({
          id: `invoice-${invoice._id}-${timelineEntry._id}`,
          type: eventType,
          message,
          date: timelineEntry.timestamp.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
          timestamp: timelineEntry.timestamp.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          details,
          actionData: {
            invoiceId: invoice._id.toString(),
          },
        });
      });
    });

    // 4. Email events (if Email model has client reference)
    // Note: This would need to be adjusted based on how emails are linked to clients
    const emails = await Email.find({
      workspace: workspaceId,
      $or: [{ 'from.email': client.user.email }, { 'to.email': client.user.email }],
    })
      .select('_id subject from to receivedAt')
      .sort({ receivedAt: -1 })
      .limit(20);

    emails.forEach((email) => {
      const isReceived = email.to.some(
        (recipient) => recipient.email.toLowerCase() === client.user.email?.toLowerCase(),
      );

      timeline.push({
        id: `email-${email._id}`,
        type: isReceived ? 'email_sent' : 'email_received',
        message: `Email ${isReceived ? 'Sent' : 'Received'} - "${email.subject}"`,
        date: email.receivedAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        timestamp: email.receivedAt.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
        details: `${isReceived ? 'Email sent to' : 'Email received from'} ${client.user.name}`,
        actionData: {
          emailId: email._id.toString(),
        },
      });
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
            hour12: true,
          }),
          details: note.content.substring(0, 100) + (note.content.length > 100 ? '...' : ''),
        });
      });
    }

    // Sort timeline by date (newest first)
    timeline.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.timestamp}`);
      const dateB = new Date(`${b.date} ${b.timestamp}`);
      return dateB - dateA;
    });

    res.status(200).json(new ApiResponse(200, timeline, 'Client timeline retrieved successfully'));
  } catch (error) {
    next(error);
  }
};
