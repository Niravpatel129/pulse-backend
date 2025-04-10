import Invoice from '../../models/invoiceModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const sendInvoice = catchAsync(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Check if the invoice belongs to the user's workspace
  if (invoice.workspace.toString() !== req.user.workspace.toString()) {
    return next(new AppError('You do not have permission to send this invoice', 403));
  }

  // Only allow sending draft invoices
  if (invoice.status !== 'draft') {
    return next(new AppError('Can only send draft invoices', 400));
  }

  // TODO: Implement email sending logic here
  // For now, just update the status
  invoice.status = 'sent';
  await invoice.save();

  res.status(200).json({
    status: 'success',
    data: invoice,
  });
});
