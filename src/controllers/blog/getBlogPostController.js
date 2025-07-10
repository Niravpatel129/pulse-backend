import BlogPost from '../../models/BlogPost.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * Get single blog post by ID
 * Supports both authenticated (workspace from middleware) and public (workspaceId from query) access
 */
export const getBlogPost = asyncHandler(async (req, res) => {
  // Check if workspaceId is provided in query (public access)
  const workspaceId = req.query.workspaceId || req.workspace?._id;
  const { id } = req.params;

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

  // Build query
  const query = { _id: id, workspace: workspaceId };

  // For public access, only show published posts
  // if (req.query.workspaceId) {
  //   query.status = 'published';
  // }

  const blogPost = await BlogPost.findOne(query)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  if (!blogPost) {
    const message = req.query.workspaceId
      ? 'Blog post not found or not published'
      : 'Blog post not found';
    throw new ApiError(404, message);
  }

  const message = req.query.workspaceId
    ? 'Public blog post retrieved successfully'
    : 'Blog post retrieved successfully';

  res.status(200).json(new ApiResponse(200, blogPost, message));
});
