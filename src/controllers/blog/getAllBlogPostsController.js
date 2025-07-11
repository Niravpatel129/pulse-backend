import BlogPost from '../../models/BlogPost.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * Get all blog posts with pagination, filtering, and search
 * Supports both authenticated (workspace from middleware) and public (workspaceId from query) access
 */
export const getAllBlogPosts = asyncHandler(async (req, res) => {
  // Check if workspaceId is provided in query (public access)
  const workspaceId = req.query.workspaceId || req.workspace?._id;

  if (!workspaceId) {
    return res
      .status(400)
      .json(
        new ApiResponse(
          400,
          null,
          'workspaceId is required for public access or user must be authenticated',
        ),
      );
  }

  const {
    page = 1,
    limit = 20,
    status,
    search,
    category,
    tag,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    includeAnalytics = 'true', // New parameter to control analytics inclusion
  } = req.query;

  // Build query
  const query = { workspace: workspaceId };

  // // Filter by status - for public access, only show published posts
  // if (req.query.workspaceId) {
  //   // Public access - only published posts
  //   query.status = 'published';
  // } else if (status) {
  //   // Authenticated access - can filter by status
  //   query.status = status;
  // }

  // Filter by category
  if (category) {
    query.categories = { $regex: new RegExp(category, 'i') };
  }

  // Filter by tag
  if (tag) {
    query.tags = { $regex: new RegExp(tag, 'i') };
  }

  // Search functionality
  if (search) {
    query.$text = { $search: search };
  }

  // Pagination
  const pageNumber = parseInt(page, 10);
  const limitNumber = Math.min(parseInt(limit, 10), 50); // Max 50 items per page
  const skip = (pageNumber - 1) * limitNumber;

  // Sort options - for public access, default to publishedAt
  const sortOptions = {};
  const defaultSortBy = req.query.workspaceId ? 'publishedAt' : 'createdAt';
  sortOptions[sortBy || defaultSortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query with pagination
  const blogPosts = await BlogPost.find(query)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email')
    .sort(sortOptions)
    .skip(skip)
    .limit(limitNumber);

  // Get total count for pagination
  const total = await BlogPost.countDocuments(query);
  const totalPages = Math.ceil(total / limitNumber);

  // Add analytics data to each blog post if requested

  const pagination = {
    page: pageNumber,
    limit: limitNumber,
    total,
    totalPages,
    hasNextPage: pageNumber < totalPages,
    hasPrevPage: pageNumber > 1,
  };

  const message = req.query.workspaceId
    ? 'Public blog posts retrieved successfully'
    : 'Blog posts retrieved successfully';

  res.status(200).json(new ApiResponse(200, blogPosts, message, { pagination }));
});
