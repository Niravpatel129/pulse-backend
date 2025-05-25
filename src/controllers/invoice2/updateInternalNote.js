import Invoice2 from '../../models/invoice2.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const updateInternalNote = catchAsync(async (req, res, next) => {
  const { internalNote } = req.body;

  if (!internalNote) {
    return next(new AppError('internalNote is required', 400));
  }

  const invoice = await Invoice2.findOneAndUpdate(
    { _id: req.params.id, workspace: req.workspace._id },
    { internalNote: internalNote },
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
