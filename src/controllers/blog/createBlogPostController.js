import BlogPost from '../../models/BlogPost.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { slugify } from '../../utils/slugify.js';

/**
 * Create a new blog post
 */
export const createBlogPost = asyncHandler(async (req, res) => {
  const workspaceId = req.workspace._id;

  const {
    title,
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

  const slug = slugify(title, { lower: true });

  // If no author provided, use the current user's name
  let postAuthor = author;
  if (!postAuthor && req.user.name) {
    postAuthor = req.user.name;
  }

  const blogPostData = {
    title,
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
    slug,
  };

  const newBlogPost = await BlogPost.create(blogPostData);

  const populatedPost = await BlogPost.findById(newBlogPost._id)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  res.status(201).json(new ApiResponse(201, populatedPost, 'Blog post created successfully'));
});
