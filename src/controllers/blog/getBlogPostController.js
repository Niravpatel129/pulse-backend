import BlogPost from '../../models/BlogPost.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * Get single blog post by ID
 */
export const getBlogPost = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const { id } = req.params;

  const blogPost = await BlogPost.findOne({ _id: id, workspace: workspaceId })
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  if (!blogPost) {
    throw new ApiError(404, 'Blog post not found');
  }

  res.status(200).json(new ApiResponse(200, blogPost, 'Blog post retrieved successfully'));
});
