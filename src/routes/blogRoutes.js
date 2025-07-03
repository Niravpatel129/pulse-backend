import express from 'express';
import {
  validateBlogPostId,
  validateBlogPostQuery,
  validateCreateBlogPost,
  validateUpdateBlogPost,
} from '../config/validators/blogPostValidators.js';
import {
  createBlogPost,
  deleteBlogPost,
  duplicateBlogPost,
  getAllBlogPosts,
  getBlogPost,
  publishBlogPost,
  unpublishBlogPost,
  updateBlogPost,
} from '../controllers/blog/index.js';
import { conditionalAuth } from '../middleware/conditionalAuth.js';
import { validateRequest } from '../middleware/expressValidatorMiddleware.js';

const router = express.Router();

// Apply conditional authentication middleware to all routes
// If workspaceId is provided in query, it's public access (no auth required)
// Otherwise, normal authentication and workspace extraction is applied
router.use(conditionalAuth);

/**
 * @route   GET /api/blog-posts
 * @desc    Get all blog posts with pagination, filtering, and search
 * @access  Public (with workspaceId) or Private (authenticated workspace member)
 * @query   {string} [workspaceId] - Workspace ID for public access (optional if authenticated)
 * @query   {number} [page=1] - Page number for pagination
 * @query   {number} [limit=20] - Number of posts per page (max 50)
 * @query   {string} [status] - Filter by status (draft, published, scheduled) - only for authenticated users
 * @query   {string} [search] - Search in title, excerpt, content, tags, categories, author
 * @query   {string} [category] - Filter by category
 * @query   {string} [tag] - Filter by tag
 * @query   {string} [sortBy=createdAt] - Sort field
 * @query   {string} [sortOrder=desc] - Sort order (asc, desc)
 * @example Public: GET /api/blog-posts?workspaceId=685d82e2a70f7eb7b0f9a606&page=1&limit=10&search=react&sortBy=publishedAt&sortOrder=desc
 * @example Private: GET /api/blog-posts?page=1&limit=10&status=published&search=react&sortBy=publishedAt&sortOrder=desc
 */
router.get('/', validateBlogPostQuery, validateRequest, getAllBlogPosts);

/**
 * @route   POST /api/blog-posts
 * @desc    Create a new blog post
 * @access  Private (workspace member)
 * @body    {string} title - Post title (required)
 * @body    {string} slug - URL slug (required)
 * @body    {string} excerpt - Post excerpt (required)
 * @body    {string} content - Post content (required)
 * @body    {string} [status=draft] - Post status (draft, published, scheduled)
 * @body    {string} [tags] - Comma-separated tags
 * @body    {string} [featuredImage] - Featured image URL
 * @body    {string} [seoTitle] - SEO title
 * @body    {string} [seoDescription] - SEO description
 * @body    {string} [publishDate] - Publish date (YYYY-MM-DD)
 * @body    {string} [publishTime] - Publish time (HH:MM)
 * @body    {string} [categories] - Comma-separated categories
 * @body    {string} author - Post author (required)
 */
router.post('/', validateCreateBlogPost, validateRequest, createBlogPost);

/**
 * @route   GET /api/blog-posts/:id
 * @desc    Get single blog post by ID
 * @access  Public (with workspaceId) or Private (authenticated workspace member)
 * @param   {string} id - Blog post ID
 * @query   {string} [workspaceId] - Workspace ID for public access (optional if authenticated)
 * @example Public: GET /api/blog-posts/507f1f77bcf86cd799439011?workspaceId=685d82e2a70f7eb7b0f9a606
 * @example Private: GET /api/blog-posts/507f1f77bcf86cd799439011
 */
router.get('/:id', validateBlogPostId, validateRequest, getBlogPost);

/**
 * @route   PUT /api/blog-posts/:id
 * @desc    Update blog post
 * @access  Private (workspace member)
 * @param   {string} id - Blog post ID
 * @body    Same as POST body (all fields optional)
 */
router.put('/:id', validateUpdateBlogPost, validateRequest, updateBlogPost);

/**
 * @route   DELETE /api/blog-posts/:id
 * @desc    Delete blog post (soft delete)
 * @access  Private (workspace member)
 * @param   {string} id - Blog post ID
 */
router.delete('/:id', validateBlogPostId, validateRequest, deleteBlogPost);

/**
 * @route   PATCH /api/blog-posts/:id/publish
 * @desc    Publish blog post
 * @access  Private (workspace member)
 * @param   {string} id - Blog post ID
 */
router.patch('/:id/publish', validateBlogPostId, validateRequest, publishBlogPost);

/**
 * @route   PATCH /api/blog-posts/:id/unpublish
 * @desc    Unpublish blog post (set to draft)
 * @access  Private (workspace member)
 * @param   {string} id - Blog post ID
 */
router.patch('/:id/unpublish', validateBlogPostId, validateRequest, unpublishBlogPost);

/**
 * @route   POST /api/blog-posts/:id/duplicate
 * @desc    Duplicate blog post
 * @access  Private (workspace member)
 * @param   {string} id - Blog post ID to duplicate
 */
router.post('/:id/duplicate', validateBlogPostId, validateRequest, duplicateBlogPost);

export default router;
