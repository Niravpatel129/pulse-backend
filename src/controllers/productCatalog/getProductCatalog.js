import mongoose from 'mongoose';
import ProductCatalog from '../../models/ProductCatalog.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const getProductCatalog = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  // Check if the ID is a valid MongoDB ObjectId
  const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { _id: id }; // This allows for string IDs

  const product = await ProductCatalog.findOne(query)
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
