import Invoice2 from '../../models/invoice2.js';
import catchAsync from '../../utils/catchAsync.js';

export const getAllInvoices = catchAsync(async (req, res, next) => {
  const invoices = await Invoice2.find({
    workspace: req.workspace._id,
  })
    .sort({ createdAt: -1 })
    .populate('attachments')
    .populate('customer.id');

  res.status(200).json({
    status: 'success',
    results: invoices.length,
    data: {
      invoices,
    },
  });
});
