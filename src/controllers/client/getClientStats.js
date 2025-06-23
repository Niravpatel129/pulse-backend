import Client from '../../models/Client.js';
import Email from '../../models/Email.js';
import Invoice2 from '../../models/invoice2.js';
import ApiResponse from '../../utils/apiResponse.js';
import AppError from '../../utils/AppError.js';

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
