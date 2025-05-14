import InvoiceTaxRate from '../../models/invoiceTaxRateModel.js';
import ApiResponse from '../../utils/apiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

export const getTaxRates = catchAsync(async (req, res, next) => {
  const workspace = req.workspace._id;

  const taxRates = await InvoiceTaxRate.find({ workspace });

  return res.status(200).json(new ApiResponse(200, taxRates));
});
