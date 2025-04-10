import ProductCatalog from '../../models/ProductCatalog.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const deleteProductCatalog = catchAsync(async (req, res, next) => {
  const product = await ProductCatalog.findByIdAndDelete(req.params.id);

  if (!product) {
    return next(new AppError('No product catalog item found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
