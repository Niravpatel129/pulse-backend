import asyncHandler from '../../middleware/asyncHandler.js';
import NewsletterSignup from '../../models/NewsletterSignup.js';
import AppError from '../../utils/AppError.js';

/**
 * @desc    Get newsletter signups for a workspace
 * @route   GET /api/newsletter/signups
 * @access  Private (workspace members)
 */
const getNewsletterSignups = asyncHandler(async (req, res, next) => {
  const { workspaceId } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const status = req.query.status;
  const source = req.query.source;
  const search = req.query.search;

  // Validate workspace ID
  if (!workspaceId) {
    return next(new AppError('Workspace ID is required', 400));
  }

  // Build query
  const query = { workspaceId };

  if (status) {
    query.status = status;
  }

  if (source) {
    query.source = source;
  }

  if (search) {
    query.$or = [
      { email: { $regex: search, $options: 'i' } },
      { workspaceName: { $regex: search, $options: 'i' } },
    ];
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Execute query with pagination
  const signups = await NewsletterSignup.find(query)
    .sort({ subscribedAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('-__v');

  // Get total count for pagination
  const total = await NewsletterSignup.countDocuments(query);

  // Calculate pagination info
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  res.status(200).json({
    success: true,
    data: {
      signups,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage,
      },
    },
  });
});

export default getNewsletterSignups;
