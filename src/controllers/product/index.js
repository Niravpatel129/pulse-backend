import Product from '../../models/product.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

// Get all products
export const getProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, category, search } = req.query;
    const query = {};

    // Add category filter if provided
    if (category) {
      query.category = category;
    }

    // Add search filter if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const products = await Product.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(query);

    return res.status(200).json(
      new ApiResponse(200, {
        products,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      }),
    );
  } catch (error) {
    next(error);
  }
};

// Get single product
export const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    return res.status(200).json(new ApiResponse(200, product));
  } catch (error) {
    next(error);
  }
};

// Create product
export const createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    return res.status(201).json(new ApiResponse(201, product));
  } catch (error) {
    next(error);
  }
};

// Update product
export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true },
    );

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    return res.status(200).json(new ApiResponse(200, product));
  } catch (error) {
    next(error);
  }
};

// Delete product
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      throw new ApiError(404, 'Product not found');
    }

    return res.status(200).json(new ApiResponse(200, { message: 'Product deleted successfully' }));
  } catch (error) {
    next(error);
  }
};
