import Invoice from '../../models/invoiceModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const updateInvoice = catchAsync(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  // update the req.body to store clientId to client
  req.body.client = req.body.clientId;

  // if status is sent, add the dateSent to the invoice
  if (req.body.status === 'sent') {
    req.body.dateSent = new Date();
  }

  // if status is paid, add the datePaid to the invoice
  if (req.body.status === 'paid') {
    req.body.datePaid = new Date();
  }

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Check if the invoice belongs to the user's workspace
  if (invoice.workspace.toString() !== req.workspace._id.toString()) {
    return next(new AppError('You do not have permission to update this invoice', 403));
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
