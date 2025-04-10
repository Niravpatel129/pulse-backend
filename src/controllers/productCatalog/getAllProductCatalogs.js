import ProductCatalog from '../../models/ProductCatalog.js';
import catchAsync from '../../utils/catchAsync.js';

export const getAllProductCatalogs = catchAsync(async (req, res) => {
  const products = await ProductCatalog.find()
    .populate('projects', 'name')
    .populate('modules', 'name');

  res.status(200).json({
    status: 'success',
    results: products.length,
    data: {
      products,
    },
  });
});
