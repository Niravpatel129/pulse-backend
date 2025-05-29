import Invoice2 from '../../models/invoice2.js';
import catchAsync from '../../utils/catchAsync.js';

export const getAllInvoices = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, status, search = '' } = req.query;

  const skip = (page - 1) * limit;

  // Build query object
  const query = {
    workspace: req.workspace._id,
  };

  // Add status filter if provided
  if (status) {
    if (status === 'overdue') {
      query.dueDate = { $lt: new Date() };
      query.status = { $ne: 'paid' }; // Exclude paid invoices
    } else {
      query.status = status;
    }
  }

  // Add search functionality
  if (search) {
    query.$or = [
      { invoiceNumber: { $regex: search, $options: 'i' } },
      { 'customer.name': { $regex: search, $options: 'i' } },
      { 'customer.email': { $regex: search, $options: 'i' } },
    ];
  }

  const total = await Invoice2.countDocuments(query);

  const totalPages = Math.ceil(total / limit);
  const currentPage = parseInt(page);

  if (currentPage > totalPages && totalPages > 0) {
    return res.status(400).json({
      status: 'error',
      message: `Page ${currentPage} does not exist. There are only ${totalPages} pages available.`,
    });
  }

  const invoices = await Invoice2.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('attachments')
    .populate('customer.id');

  res.status(200).json({
    status: 'success',
    results: invoices.length,
    pagination: {
      total,
      page: currentPage,
      limit: parseInt(limit),
      pages: totalPages,
    },
    data: {
      invoices,
    },
  });
});
