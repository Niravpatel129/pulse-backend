import Invoice from '../../models/invoiceModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const deleteInvoice = catchAsync(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Check if the invoice belongs to the user's workspace
  if (invoice.workspace.toString() !== req.workspace._id.toString()) {
    return next(new AppError('You do not have permission to delete this invoice', 403));
  }

  await Invoice.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
