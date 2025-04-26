import mongoose from 'mongoose';
import ProductCatalog from '../../models/ProductCatalog.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const deleteProductCatalog = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  // Check if the ID is a valid MongoDB ObjectId
  const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { _id: id }; // This allows for string IDs

  const product = await ProductCatalog.findOneAndDelete(query);

  if (!product) {
    return next(new AppError('No product catalog item found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
