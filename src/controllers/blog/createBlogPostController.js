import BlogPost from '../../models/BlogPost.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * Create a new blog post
 */
export const createBlogPost = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;

  const {
    title,
    slug,
    excerpt,
    content,
    status = 'draft',
    tags = '',
    featuredImage = '',
    seoTitle,
    seoDescription,
    publishDate,
    publishTime,
    categories = '',
    author,
  } = req.body;

  // Check if slug already exists for this workspace
  const existingPost = await BlogPost.findOne({ workspace: workspaceId, slug });
  if (existingPost) {
    throw new ApiError(400, 'A blog post with this slug already exists');
  }

  // If no author provided, use the current user's name
  let postAuthor = author;
  if (!postAuthor && req.user.name) {
    postAuthor = req.user.name;
  }

  const blogPostData = {
    title,
    slug,
    excerpt,
    content,
    status,
    tags,
    featuredImage,
    seoTitle: seoTitle || title, // Default to title if no SEO title
    seoDescription: seoDescription || excerpt, // Default to excerpt if no SEO description
    publishDate,
    publishTime,
    categories,
    author: postAuthor,
    workspace: workspaceId,
    createdBy: req.user.userId,
    lastModifiedBy: req.user.userId,
  };

  const newBlogPost = await BlogPost.create(blogPostData);

  const populatedPost = await BlogPost.findById(newBlogPost._id)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  res.status(201).json(new ApiResponse(201, populatedPost, 'Blog post created successfully'));
});
