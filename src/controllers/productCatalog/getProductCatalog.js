import ProductCatalog from '../../models/ProductCatalog.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const getProductCatalog = catchAsync(async (req, res, next) => {
  const product = await ProductCatalog.findById(req.params.id)
    .populate('projects', 'name')
    .populate('modules', 'name');

  if (!product) {
    return next(new AppError('No product catalog item found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      product,
    },
  });
});
