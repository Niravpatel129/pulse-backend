import mongoose from 'mongoose';
import DigitalProduct from '../../models/DigitalProduct.js';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import AppError from '../../utils/AppError.js';

// Create a new digital product
export const createDigitalProduct = async (req, res, next) => {
  const userId = req.user.userId;
  try {
    const {
      name,
      description,
      price,
      originalPrice,
      features,
      category,
      image,
      fileUrl,
      fileSize,
      fileType,
      downloadLimit,
      popular,
      workspace,
    } = req.body;

    // Validate required fields
    if (!name || !description || !price || !features || !category || !workspace) {
      return next(new AppError('Missing required fields', 400));
    }

    // Validate features array
    if (!Array.isArray(features) || features.length === 0) {
      return next(new AppError('Features must be a non-empty array', 400));
    }

    // Create new digital product
    const digitalProduct = new DigitalProduct({
      name,
      description,
      price,
      originalPrice,
      features,
      category,
      image,
      fileUrl,
      fileSize,
      fileType,
      downloadLimit,
      popular: popular || false,
      workspace: new mongoose.Types.ObjectId(workspace),
      createdBy: userId,
    });

    await digitalProduct.save();

    res.status(201).json({
      success: true,
      data: {
        product: digitalProduct,
      },
    });
  } catch (error) {
    console.error('Error creating digital product:', error);
    next(new AppError('Failed to create digital product', 500));
  }
};

// Update a digital product
export const updateDigitalProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.createdBy;
    delete updateData.createdAt;
    delete updateData.downloadCount;

    const digitalProduct = await DigitalProduct.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true },
    );

    if (!digitalProduct) {
      return next(new AppError('Digital product not found', 404));
    }

    res.status(200).json({
      success: true,
      data: {
        product: digitalProduct,
      },
    });
  } catch (error) {
    console.error('Error updating digital product:', error);
    next(new AppError('Failed to update digital product', 500));
  }
};

// Delete a digital product (soft delete by setting active to false)
export const deleteDigitalProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const digitalProduct = await DigitalProduct.findByIdAndUpdate(
      id,
      { active: false, updatedAt: new Date() },
      { new: true },
    );

    if (!digitalProduct) {
      return next(new AppError('Digital product not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Digital product deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting digital product:', error);
    next(new AppError('Failed to delete digital product', 500));
  }
};

// Get all digital products for admin (including inactive ones)
export const getAllDigitalProductsAdmin = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, category, active, workspaceId } = req.query;

    // Build query filter
    const filter = {};

    if (workspaceId) {
      filter.workspace = workspaceId;
    }

    if (category) {
      filter.category = category;
    }

    if (active !== undefined) {
      filter.active = active === 'true';
    }

    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const [products, totalCount] = await Promise.all([
      DigitalProduct.find(filter)
        .populate('createdBy', 'firstName lastName email')
        .populate('workspace', 'name currency')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      DigitalProduct.countDocuments(filter),
    ]);

    // Get stripe accounts for all workspaces in the results
    const workspaceIds = products.map((p) => p.workspace._id);
    const stripeAccounts = await StripeConnectAccount.find({
      workspace: { $in: workspaceIds },
    }).lean();

    // Add stripe account info to each product
    const productsWithStripe = products.map((product) => {
      const stripeAccount = stripeAccounts.find(
        (account) => account.workspace.toString() === product.workspace._id.toString(),
      );
      return {
        ...product,
        stripeAccount: stripeAccount
          ? {
              accountId: stripeAccount.accountId,
              chargesEnabled: stripeAccount.chargesEnabled,
              detailsSubmitted: stripeAccount.detailsSubmitted,
              status: stripeAccount.status,
            }
          : null,
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: {
        products: productsWithStripe,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching digital products (admin):', error);
    next(new AppError('Failed to fetch digital products', 500));
  }
};
