import Invoice2 from '../../models/invoice2.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const updateInvoiceStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;

  if (!['draft', 'sent', 'paid', 'overdue', 'cancelled'].includes(status)) {
    return next(new AppError('Invalid status value', 400));
  }

  const invoice = await Invoice2.findOneAndUpdate(
    { _id: req.params.id, workspace: req.workspace._id },
    { status },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      invoice,
    },
  });
});
