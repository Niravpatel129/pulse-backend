import BlogPost from '../../models/BlogPost.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * Duplicate blog post
 */
export const duplicateBlogPost = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;
  const userId = req.user._id;
  const { id } = req.params;

  const originalPost = await BlogPost.findOne({ _id: id, workspace: workspaceId });
  if (!originalPost) {
    throw new ApiError(404, 'Blog post not found');
  }

  // Generate a unique slug for the duplicate
  const baseSlug = `${originalPost.slug}-copy`;
  let newSlug = baseSlug;
  let counter = 1;

  // Check if slug exists and increment counter until we find a unique one
  while (await BlogPost.findOne({ workspace: workspaceId, slug: newSlug })) {
    newSlug = `${baseSlug}-${counter}`;
    counter++;
  }

  // Create duplicate with modified fields
  const duplicateData = {
    title: `${originalPost.title} (Copy)`,
    slug: newSlug,
    excerpt: originalPost.excerpt,
    content: originalPost.content,
    status: 'draft', // Always start as draft
    tags: originalPost.tags,
    featuredImage: originalPost.featuredImage,
    seoTitle: originalPost.seoTitle ? `${originalPost.seoTitle} (Copy)` : undefined,
    seoDescription: originalPost.seoDescription,
    publishDate: originalPost.publishDate,
    publishTime: originalPost.publishTime,
    categories: originalPost.categories,
    author: originalPost.author,
    workspace: workspaceId,
    createdBy: userId,
    lastModifiedBy: userId,
  };

  const duplicatedPost = await BlogPost.create(duplicateData);

  const populatedPost = await BlogPost.findById(duplicatedPost._id)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  res.status(201).json(new ApiResponse(201, populatedPost, 'Blog post duplicated successfully'));
});
