import BlogPost from '../../models/BlogPost.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * Get all blog posts with pagination, filtering, and search
 */
export const getAllBlogPosts = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;

  const {
    page = 1,
    limit = 20,
    status,
    search,
    category,
    tag,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  // Build query
  const query = { workspace: workspaceId };

  // Filter by status
  if (status) {
    query.status = status;
  }

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

  // Sort options
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

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

  const pagination = {
    page: pageNumber,
    limit: limitNumber,
    total,
    totalPages,
    hasNextPage: pageNumber < totalPages,
    hasPrevPage: pageNumber > 1,
  };

  res
    .status(200)
    .json(new ApiResponse(200, blogPosts, 'Blog posts retrieved successfully', { pagination }));
});
