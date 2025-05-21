import Invoice from '../../models/invoiceModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const getInvoiceTimeline = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const invoice = await Invoice.findOne({
    _id: id,
    workspace: req.workspace._id,
  }).select('timeline invoiceNumber');

  if (!invoice) {
    return next(new AppError('Invoice not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      timeline: invoice.timeline || [],
    },
  });
});
