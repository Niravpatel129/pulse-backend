import Activity from '../../models/Activity.js';
import Client from '../../models/Client.js';
import Email from '../../models/Email.js';
import Invoice2 from '../../models/invoice2.js';
import Invoice from '../../models/invoiceModel.js';
import Note from '../../models/Note.js';
import Payment from '../../models/paymentModel.js';
import Project from '../../models/Project.js';
import ApiResponse from '../../utils/apiResponse.js';
import AppError from '../../utils/AppError.js';

// Get all clients
export const getClients = async (req, res, next) => {
  try {
    const { search } = req.query;

    // Build query
    let query = { workspace: req.workspace._id };

    // Add search condition if search parameter exists
    if (search) {
      query = {
        ...query,
        $or: [
          { 'user.name': { $regex: search, $options: 'i' } },
          { 'user.email': { $regex: search, $options: 'i' } },
        ],
      };
    }

    // First get all clients with search filter
    const clients = await Client.find(query).sort({ createdAt: -1 });

    // Get total spent for each client by aggregating payments
    const clientPayments = await Payment.aggregate([
      {
        $match: {
          workspace: req.workspace._id,
          status: 'completed',
        },
      },
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoice',
          foreignField: '_id',
          as: 'invoice',
        },
      },
      {
        $unwind: '$invoice',
      },
      {
        $group: {
          _id: '$invoice.client',
          totalSpent: { $sum: '$amount' },
        },
      },
    ]);

    // Create a map of client ID to total spent
    const totalSpentMap = new Map(
      clientPayments.map((payment) => [payment._id.toString(), payment.totalSpent]),
    );

    // Add totalSpent to each client
    const clientsWithTotalSpent = clients.map((client) => {
      const clientObj = client.toObject();
      clientObj.totalSpent = totalSpentMap.get(client._id.toString()) || 0;
      return clientObj;
    });

    res
      .status(200)
      .json(new ApiResponse(200, clientsWithTotalSpent, 'Clients retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Get a single client
export const getClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    res.status(200).json(new ApiResponse(200, client, 'Client retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Create a new client
export const createClient = async (req, res, next) => {
  try {
    const {
      user,
      phone,
      address,
      shippingAddress,
      contact,
      taxId,
      accountNumber,
      fax,
      mobile,
      tollFree,
      website,
      internalNotes,
      customFields,
    } = req.body;

    const client = await Client.create({
      user,
      workspace: req.workspace._id,
      phone,
      address,
      shippingAddress,
      contact: contact || {
        firstName: user.name,
      },
      taxId,
      accountNumber,
      fax,
      mobile,
      tollFree,
      website,
      internalNotes,
      customFields,
    });

    // Create activity for client creation
    await Activity.create({
      user: req.user._id,
      workspace: req.workspace._id,
      type: 'client',
      action: 'created',
      description: `Client "${client.user.name}" was created`,
      entityId: client._id,
      entityType: 'client',
      metadata: {
        clientName: client.user.name,
        clientEmail: client.user.email,
      },
    });

    res.status(201).json(new ApiResponse(201, client, 'Client created successfully'));
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('A client with this email already exists in this workspace', 400));
    }
    next(error);
  }
};

// Update a client
export const updateClient = async (req, res, next) => {
  try {
    const {
      user,
      phone,
      address,
      shippingAddress,
      contact,
      taxId,
      accountNumber,
      fax,
      mobile,
      tollFree,
      website,
      internalNotes,
      customFields,
      isActive,
    } = req.body;

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      {
        user,
        phone,
        address,
        shippingAddress,
        contact,
        taxId,
        accountNumber,
        fax,
        mobile,
        tollFree,
        website,
        internalNotes,
        customFields,
        isActive,
      },
      { new: true, runValidators: true },
    );

    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    // Update client information in Invoice2 documents
    await Invoice2.updateMany(
      { 'customer.id': req.params.id },
      {
        $set: {
          'customer.name': client.user.name,
          'customer.email': client.user.email,
        },
      },
    );

    // Create activity for client update
    await Activity.create({
      user: req.user._id,
      workspace: req.workspace._id,
      type: 'client',
      action: 'updated',
      description: `Client "${client.user.name}" information was updated`,
      entityId: client._id,
      entityType: 'client',
      metadata: {
        clientName: client.user.name,
        clientEmail: client.user.email,
      },
    });

    res.status(200).json(new ApiResponse(200, client, 'Client updated successfully'));
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('A client with this email already exists in this workspace', 400));
    }
    next(error);
  }
};

// Soft delete a client
export const deleteClient = async (req, res, next) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { deletedAt: new Date() },
      { new: true },
    );

    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    res.status(200).json(new ApiResponse(200, null, 'Client deleted successfully'));
  } catch (error) {
    next(error);
  }
};

// Restore a soft-deleted client
export const restoreClient = async (req, res, next) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { deletedAt: null },
      { new: true },
    );

    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    res.status(200).json(new ApiResponse(200, client, 'Client restored successfully'));
  } catch (error) {
    next(error);
  }
};

// Update client status
export const updateClientStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    // Validate status
    if (!status || !['active', 'inactive', 'archived'].includes(status)) {
      return next(
        new AppError('Invalid status. Status must be one of: active, inactive, archived', 400),
      );
    }

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true },
    );

    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    res.status(200).json(new ApiResponse(200, client, 'Client status updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Get client statistics
export const getClientStats = async (req, res, next) => {
  try {
    const clientId = req.params.id;

    // Check if client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    // Get all invoices for this client
    const invoices = await Invoice2.find({
      'customer.id': clientId,
      workspace: req.workspace._id,
    });

    // Calculate total amount spent (sum of all paid invoices)
    const paidInvoices = invoices.filter((invoice) =>
      ['paid', 'partially_paid'].includes(invoice.status),
    );

    const totalAmountSpent = paidInvoices.reduce((sum, invoice) => {
      if (invoice.status === 'paid') {
        return sum + invoice.totals.total;
      } else if (invoice.status === 'partially_paid') {
        return sum + (invoice.depositPaymentAmount || 0);
      }
      return sum;
    }, 0);

    // Get currency from the first invoice or default to CAD
    const currency = invoices.length > 0 ? invoices[0].settings.currency : 'CAD';

    // Format amount spent
    const formattedAmount = new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency,
    }).format(totalAmountSpent);

    // Count invoices
    const invoiceCount = invoices.length;

    // Count emails related to this client
    const emailCount = await Email.countDocuments({
      workspaceId: req.workspace._id,
      $or: [
        { 'from.email': client.user.email },
        { 'to.email': client.user.email },
        { 'cc.email': client.user.email },
        { 'bcc.email': client.user.email },
      ],
    });

    // Calculate customer since (time since client was created)
    const createdAt = client.createdAt;
    const now = new Date();
    const diffTime = Math.abs(now - createdAt);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let customerSince;
    if (diffDays < 30) {
      customerSince = `${diffDays} days`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      customerSince = `${months} month${months > 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      const remainingMonths = Math.floor((diffDays % 365) / 30);
      if (remainingMonths > 0) {
        customerSince = `${years} year${years > 1 ? 's' : ''} ${remainingMonths} month${
          remainingMonths > 1 ? 's' : ''
        }`;
      } else {
        customerSince = `${years} year${years > 1 ? 's' : ''}`;
      }
    }

    const stats = {
      amountSpent: formattedAmount,
      invoices: invoiceCount.toString(),
      emails: emailCount.toString(),
      customerSince,
    };

    res.status(200).json(new ApiResponse(200, stats, 'Client stats retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

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
