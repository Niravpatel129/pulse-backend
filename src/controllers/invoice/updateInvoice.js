import Invoice from '../../models/invoiceModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const updateInvoice = catchAsync(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Check if the invoice belongs to the user's workspace
  if (invoice.workspace.toString() !== req.workspace._id.toString()) {
    return next(new AppError('You do not have permission to update this invoice', 403));
  }

  // Allow status changes from draft to sent
  if (req.body.status === 'sent' && invoice.status === 'draft') {
    const updatedInvoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { status: 'sent' },
      {
        new: true,
        runValidators: true,
      },
    );

    return res.status(200).json({
      status: 'success',
      data: updatedInvoice,
    });
  }

  // For other updates, only allow updates to draft invoices
  if (invoice.status !== 'draft') {
    return next(new AppError('Can only update draft invoices', 400));
  }

  const updatedInvoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: updatedInvoice,
  });
});
