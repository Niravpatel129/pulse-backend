import Invoice from '../../models/invoiceModel.js';
import catchAsync from '../../utils/catchAsync.js';

export const getInvoices = catchAsync(async (req, res, next) => {
  const invoices = await Invoice.find({ workspace: req.user.workspace })
    .populate('client', 'name email')
    .populate('project', 'name')
    .populate('createdBy', 'name');

  res.status(200).json({
    status: 'success',
    results: invoices.length,
    data: invoices,
  });
});
