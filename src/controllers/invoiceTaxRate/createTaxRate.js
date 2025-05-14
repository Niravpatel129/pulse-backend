import InvoiceTaxRate from '../../models/invoiceTaxRateModel.js';
import ApiResponse from '../../utils/apiResponse.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const createTaxRate = catchAsync(async (req, res, next) => {
  const { name, rate, description, isDefault } = req.body;
  const workspace = req.workspace._id;
  const userId = req.user.userId;

  if (!name || rate === undefined) {
    return next(new AppError('Name and rate are required', 400));
  }

  // If this rate is set as default, remove default status from other rates
  if (isDefault) {
    await InvoiceTaxRate.updateMany({ workspace, isDefault: true }, { isDefault: false });
  }

  const taxRate = await InvoiceTaxRate.create({
    name,
    rate,
    description: description || '',
    isDefault: isDefault || false,
    workspace,
    createdBy: userId,
  });

  return res.status(201).json(new ApiResponse(201, taxRate));
});
