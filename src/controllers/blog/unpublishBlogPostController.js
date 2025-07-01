import BlogPost from '../../models/BlogPost.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * Unpublish blog post
 */
export const unpublishBlogPost = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const userId = req.user._id;
  const { id } = req.params;

  const blogPost = await BlogPost.findOne({ _id: id, workspace: workspaceId });
  if (!blogPost) {
    throw new ApiError(404, 'Blog post not found');
  }

  if (blogPost.status !== 'published') {
    throw new ApiError(400, 'Blog post is not currently published');
  }

  const updatedPost = await BlogPost.findByIdAndUpdate(
    id,
    {
      status: 'draft',
      lastModifiedBy: userId,
    },
    { new: true, runValidators: true },
  )
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  res.status(200).json(new ApiResponse(200, updatedPost, 'Blog post unpublished successfully'));
});
