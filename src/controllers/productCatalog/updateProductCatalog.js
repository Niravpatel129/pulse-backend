import ProductCatalog from '../../models/ProductCatalog.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const updateProductCatalog = catchAsync(async (req, res, next) => {
  const { name, quantity, price, projects, modules, discount } = req.body;

  const product = await ProductCatalog.findByIdAndUpdate(
    req.params.id,
    {
      name,
      quantity,
      price,
      projects: projects || [],
      modules: modules || [],
      discount,
    },
    {
      new: true,
      runValidators: true,
    },
  );

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
