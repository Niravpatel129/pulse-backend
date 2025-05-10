import Invoice from '../../models/invoiceModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const toggleStar = catchAsync(async (req, res, next) => {
  const { starred } = req.body;
  const invoiceId = req.params.id;

  if (typeof starred !== 'boolean') {
    return next(new AppError('Starred status must be a boolean value', 400));
  }

  const invoice = await Invoice.findById(invoiceId);

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Check if the invoice belongs to the user's workspace
  if (invoice.workspace.toString() !== req.workspace._id.toString()) {
    return next(new AppError('You do not have permission to update this invoice', 403));
  }

  invoice.starred = starred;
  await invoice.save();

  res.status(200).json({
    status: 'success',
    data: invoice,
  });
});
