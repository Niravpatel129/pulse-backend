import Invoice from '../../models/invoiceModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const getPublicInvoice = catchAsync(async (req, res, next) => {
  try {
    if (!req.params.id) {
      return next(new AppError('No invoice ID provided', 400));
    }

    const invoice = await Invoice.findById(req.params.id)
      .populate({
        path: 'client',
        select: '-__v',
      })
      .populate('items', 'name description price discount')
      .populate('project', 'name')
      .populate('createdBy', 'name');

    if (!invoice) {
      return next(new AppError('No invoice found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
});
