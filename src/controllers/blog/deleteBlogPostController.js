import BlogPost from '../../models/BlogPost.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * Delete blog post (soft delete)
 */
export const deleteBlogPost = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const { id } = req.params;

  const blogPost = await BlogPost.findOne({ _id: id, workspace: workspaceId });
  if (!blogPost) {
    throw new ApiError(404, 'Blog post not found');
  }

  // Soft delete by setting isDeleted to true
  await BlogPost.findByIdAndUpdate(id, {
    isDeleted: true,
    lastModifiedBy: req.user._id,
  });

  res.status(200).json(new ApiResponse(200, null, 'Blog post deleted successfully'));
});
