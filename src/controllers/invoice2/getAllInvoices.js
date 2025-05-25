import Invoice2 from '../../models/invoice2.js';
import catchAsync from '../../utils/catchAsync.js';

export const getAllInvoices = catchAsync(async (req, res, next) => {
  const invoices = await Invoice2.find({
    workspace: req.workspace._id,
  });

  res.status(200).json({
    status: 'success',
    results: invoices.length,
    data: {
      invoices,
    },
  });
});
