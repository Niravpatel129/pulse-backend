import BlogPost from '../../models/BlogPost.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * Update blog post
 */
export const updateBlogPost = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const userId = req.user._id;
  const { id } = req.params;

  const existingPost = await BlogPost.findOne({ _id: id, workspace: workspaceId });
  if (!existingPost) {
    throw new ApiError(404, 'Blog post not found');
  }

  const {
    title,
    slug,
    excerpt,
    content,
    status,
    tags,
    featuredImage,
    seoTitle,
    seoDescription,
    publishDate,
    publishTime,
    categories,
    author,
  } = req.body;

  // Check if slug is being changed and if it conflicts with existing posts
  if (slug && slug !== existingPost.slug) {
    const conflictingPost = await BlogPost.findOne({
      workspace: workspaceId,
      slug,
      _id: { $ne: id },
    });
    if (conflictingPost) {
      throw new ApiError(400, 'A blog post with this slug already exists');
    }
  }

  // Prepare update data
  const updateData = {
    lastModifiedBy: userId,
  };

  // Only update fields that are provided
  if (title !== undefined) updateData.title = title;
  if (slug !== undefined) updateData.slug = slug;
  if (excerpt !== undefined) updateData.excerpt = excerpt;
  if (content !== undefined) updateData.content = content;
  if (status !== undefined) updateData.status = status;
  if (tags !== undefined) updateData.tags = tags;
  if (featuredImage !== undefined) updateData.featuredImage = featuredImage;
  if (seoTitle !== undefined) updateData.seoTitle = seoTitle;
  if (seoDescription !== undefined) updateData.seoDescription = seoDescription;
  if (publishDate !== undefined) updateData.publishDate = publishDate;
  if (publishTime !== undefined) updateData.publishTime = publishTime;
  if (categories !== undefined) updateData.categories = categories;
  if (author !== undefined) updateData.author = author;

  const updatedPost = await BlogPost.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  })
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  res.status(200).json(new ApiResponse(200, updatedPost, 'Blog post updated successfully'));
});
