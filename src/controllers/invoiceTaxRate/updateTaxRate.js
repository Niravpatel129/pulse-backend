import InvoiceTaxRate from '../../models/invoiceTaxRateModel.js';
import ApiResponse from '../../utils/apiResponse.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const updateTaxRate = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, rate, description, isDefault } = req.body;
  const workspace = req.workspace._id;

  const taxRate = await InvoiceTaxRate.findOne({ _id: id, workspace });

  if (!taxRate) {
    return next(new AppError('Tax rate not found', 404));
  }

  // If this rate is being set as default, remove default status from other rates
  if (isDefault && !taxRate.isDefault) {
    await InvoiceTaxRate.updateMany({ workspace, isDefault: true }, { isDefault: false });
  }

  taxRate.name = name || taxRate.name;
  taxRate.rate = rate !== undefined ? rate : taxRate.rate;
  taxRate.description = description !== undefined ? description : taxRate.description;
  taxRate.isDefault = isDefault !== undefined ? isDefault : taxRate.isDefault;

  await taxRate.save();

  return res.status(200).json(new ApiResponse(200, taxRate));
});
