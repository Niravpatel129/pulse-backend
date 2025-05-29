import Invoice2 from '../../models/invoice2.js';
import catchAsync from '../../utils/catchAsync.js';

export const getAllInvoices = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;

  const skip = (page - 1) * limit;

  const total = await Invoice2.countDocuments({
    workspace: req.workspace._id,
  });

  const invoices = await Invoice2.find({
    workspace: req.workspace._id,
  })
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
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
    },
    data: {
      invoices,
    },
  });
});
