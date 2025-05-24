import Invoice2 from '../../models/invoice2.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const updateInvoice = catchAsync(async (req, res, next) => {
  const invoice = await Invoice2.findOneAndUpdate(
    { _id: req.params.id, workspace: req.workspace._id },
    req.body,
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
