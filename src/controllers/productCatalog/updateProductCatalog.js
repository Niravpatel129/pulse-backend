import mongoose from 'mongoose';
import ProductCatalog from '../../models/ProductCatalog.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const updateProductCatalog = catchAsync(async (req, res, next) => {
  const { name, quantity, price, projects, modules, discount } = req.body;
  const id = req.params.id;

  // Check if the ID is a valid MongoDB ObjectId
  const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { _id: id }; // This allows for string IDs

  const product = await ProductCatalog.findOneAndUpdate(
    query,
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
      upsert: true, // Create a new document if no match is found
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
