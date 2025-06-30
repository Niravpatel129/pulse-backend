import mongoose from 'mongoose';
import DigitalProductPurchase from '../../models/DigitalProductPurchase.js';
import AppError from '../../utils/AppError.js';

// Get all purchases for admin
export const getAllPurchases = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, paymentStatus, workspaceId, email, orderId } = req.query;

    // Build query filter
    const filter = {};

    if (workspaceId) {
      filter.workspace = workspaceId;
    }

    if (status) {
      filter.status = status;
    }

    if (paymentStatus) {
      filter['paymentInfo.paymentStatus'] = paymentStatus;
    }

    if (email) {
      filter['customerInfo.email'] = { $regex: email, $options: 'i' };
    }

    if (orderId) {
      filter.orderId = { $regex: orderId, $options: 'i' };
    }

    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const [purchases, totalCount] = await Promise.all([
      DigitalProductPurchase.find(filter)
        .populate('product', 'name description price category')
        .populate('workspace', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      DigitalProductPurchase.countDocuments(filter),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: {
        purchases,
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
    console.error('Error fetching purchases:', error);
    next(new AppError('Failed to fetch purchases', 500));
  }
};

// Get a specific purchase by order ID
export const getPurchase = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const purchase = await DigitalProductPurchase.findOne({ orderId })
      .populate('product', 'name description price category image')
      .populate('workspace', 'name')
      .lean();

    if (!purchase) {
      return next(new AppError('Purchase not found', 404));
    }

    res.status(200).json({
      success: true,
      data: {
        purchase,
      },
    });
  } catch (error) {
    console.error('Error fetching purchase:', error);
    next(new AppError('Failed to fetch purchase', 500));
  }
};

// Get purchases by customer email
export const getPurchasesByEmail = async (req, res, next) => {
  try {
    const { email } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!email) {
      return next(new AppError('Email is required', 400));
    }

    // Calculate skip value for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const [purchases, totalCount] = await Promise.all([
      DigitalProductPurchase.find({
        'customerInfo.email': email.toLowerCase(),
        status: 'completed',
      })
        .populate('product', 'name description price category image')
        .select('-paymentInfo.stripeClientSecret -downloadInfo.downloadToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      DigitalProductPurchase.countDocuments({
        'customerInfo.email': email.toLowerCase(),
        status: 'completed',
      }),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: {
        purchases,
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
    console.error('Error fetching purchases by email:', error);
    next(new AppError('Failed to fetch purchases', 500));
  }
};

// Get purchase analytics/stats
export const getPurchaseStats = async (req, res, next) => {
  try {
    const { workspaceId } = req.query;

    const matchStage = workspaceId ? { workspace: new mongoose.Types.ObjectId(workspaceId) } : {};

    const stats = await DigitalProductPurchase.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: 1 },
          completedPurchases: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, '$paymentInfo.amount', 0],
            },
          },
          averageOrderValue: {
            $avg: {
              $cond: [{ $eq: ['$status', 'completed'] }, '$paymentInfo.amount', null],
            },
          },
        },
      },
    ]);

    // Get top products
    const topProducts = await DigitalProductPurchase.aggregate([
      { $match: { ...matchStage, status: 'completed' } },
      {
        $group: {
          _id: '$product',
          purchaseCount: { $sum: 1 },
          revenue: { $sum: '$paymentInfo.amount' },
        },
      },
      {
        $lookup: {
          from: 'digitalproducts',
          localField: '_id',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: '$productInfo' },
      {
        $project: {
          _id: 1,
          purchaseCount: 1,
          revenue: 1,
          name: '$productInfo.name',
          category: '$productInfo.category',
        },
      },
      { $sort: { purchaseCount: -1 } },
      { $limit: 5 },
    ]);

    const result = stats[0] || {
      totalPurchases: 0,
      completedPurchases: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
    };

    res.status(200).json({
      success: true,
      data: {
        stats: result,
        topProducts,
      },
    });
  } catch (error) {
    console.error('Error fetching purchase stats:', error);
    next(new AppError('Failed to fetch purchase statistics', 500));
  }
};
