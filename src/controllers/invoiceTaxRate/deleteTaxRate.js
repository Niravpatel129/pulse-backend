import InvoiceTaxRate from '../../models/invoiceTaxRateModel.js';
import ApiResponse from '../../utils/apiResponse.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const deleteTaxRate = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const workspace = req.workspace._id;

  const taxRate = await InvoiceTaxRate.findOne({ _id: id, workspace });

  if (!taxRate) {
    return next(new AppError('Tax rate not found', 404));
  }

  await taxRate.deleteOne();

  return res.status(200).json(new ApiResponse(200, { message: 'Tax rate deleted successfully' }));
});
