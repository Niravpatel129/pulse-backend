import Invoice from '../../models/invoiceModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const getInvoice = catchAsync(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('client', 'name email')
    .populate('project', 'name')
    .populate('createdBy', 'name');

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Check if the invoice belongs to the user's workspace
  if (invoice.workspace.toString() !== req.user.workspace.toString()) {
    return next(new AppError('You do not have permission to view this invoice', 403));
  }

  res.status(200).json({
    status: 'success',
    data: invoice,
  });
});
