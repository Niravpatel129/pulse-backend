import Invoice from '../../models/invoiceModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const markAsPaid = catchAsync(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Check if the invoice belongs to the user's workspace
  if (invoice.workspace.toString() !== req.user.workspace.toString()) {
    return next(new AppError('You do not have permission to mark this invoice as paid', 403));
  }

  // Only allow marking sent invoices as paid
  if (invoice.status !== 'sent') {
    return next(new AppError('Can only mark sent invoices as paid', 400));
  }

  invoice.status = 'paid';
  await invoice.save();

  res.status(200).json({
    status: 'success',
    data: invoice,
  });
});
