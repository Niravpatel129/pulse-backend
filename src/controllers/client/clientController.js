import Client from '../../models/Client.js';
import Email from '../../models/Email.js';
import Invoice2 from '../../models/invoice2.js';
import Payment from '../../models/paymentModel.js';
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
          'customer.name': client.name,
          'customer.email': client.email,
        },
      },
    );

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
