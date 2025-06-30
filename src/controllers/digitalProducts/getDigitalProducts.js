import DigitalProduct from '../../models/DigitalProduct.js';
import StripeConnectAccount from '../../models/StripeConnectAccount.js';
import AppError from '../../utils/AppError.js';

export const getDigitalProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      priceMin,
      priceMax,
      popular,
      search,
      workspaceId,
    } = req.query;

    // Build query filter
    const filter = { active: true };

    if (workspaceId) {
      filter.workspace = workspaceId;
    }

    if (category) {
      filter.category = category;
    }

    if (priceMin || priceMax) {
      filter.price = {};
      if (priceMin) filter.price.$gte = parseFloat(priceMin);
      if (priceMax) filter.price.$lte = parseFloat(priceMax);
    }

    if (popular === 'true') {
      filter.popular = true;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const [products, totalCount] = await Promise.all([
      DigitalProduct.find(filter)
        .populate('workspace', 'name subdomain currency')
        .select('-fileUrl -createdBy') // Exclude sensitive fields
        .sort({ popular: -1, downloadCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      DigitalProduct.countDocuments(filter),
    ]);

    // Get stripe accounts for all workspaces
    const workspaceIds = products.map((p) => p.workspace._id);
    const stripeAccounts = await StripeConnectAccount.find({
      workspace: { $in: workspaceIds },
    }).lean();

    // Create a map for quick lookup
    const stripeAccountMap = stripeAccounts.reduce((map, account) => {
      map[account.workspace.toString()] = account;
      return map;
    }, {});

    // Filter out products where the connected account is not properly configured
    const availableProducts = products.filter((product) => {
      const stripeAccount = stripeAccountMap[product.workspace._id.toString()];
      return stripeAccount && stripeAccount.chargesEnabled && stripeAccount.detailsSubmitted;
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: {
        products: availableProducts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(availableProducts.length / parseInt(limit)),
          totalCount: availableProducts.length,
          hasNextPage: parseInt(page) < Math.ceil(availableProducts.length / parseInt(limit)),
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching digital products:', error);
    next(new AppError('Failed to fetch digital products', 500));
  }
};

export const getDigitalProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await DigitalProduct.findById(id)
      .populate('workspace', 'name subdomain currency')
      .select('-fileUrl -createdBy') // Exclude sensitive fields
      .lean();

    if (!product) {
      return next(new AppError('Digital product not found', 404));
    }

    if (!product.active) {
      return next(new AppError('Digital product is not available', 400));
    }

    // Find the connected Stripe account for this workspace
    const stripeAccount = await StripeConnectAccount.findOne({
      workspace: product.workspace._id,
    });

    // Verify the connected account is properly configured
    if (!stripeAccount || !stripeAccount.chargesEnabled || !stripeAccount.detailsSubmitted) {
      return next(new AppError('This product is temporarily unavailable', 400));
    }

    res.status(200).json({
      success: true,
      data: {
        product,
      },
    });
  } catch (error) {
    console.error('Error fetching digital product:', error);
    next(new AppError('Failed to fetch digital product', 500));
  }
};
