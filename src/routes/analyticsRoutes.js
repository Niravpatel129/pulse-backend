import express from 'express';
import {
  validateAnalyticsSummary,
  validateBlogPostAnalytics,
  validateReaderEngagement,
  validateTrackBlogRead,
} from '../config/validators/analyticsValidators.js';
import {
  getAnalyticsSummary,
  getBlogPostAnalytics,
  getReaderEngagement,
  trackBlogRead,
} from '../controllers/analytics/index.js';
import { validateRequest } from '../middleware/expressValidatorMiddleware.js';
import { extractWorkspaceWithoutAuth } from '../middleware/workspace.js';

const router = express.Router();

/**
 * @route   POST /api/analytics/blog-read
 * @desc    Track a blog post read/view
 * @access  Public (no authentication required)
 * @body    {string} postId - Blog post ID (required)
 * @body    {string} postTitle - Blog post title (optional, will use from DB if not provided)
 * @body    {string} workspaceId - Workspace ID (required)
 * @body    {string} [readerId] - User ID if logged in (optional)
 * @body    {string} sessionId - Session ID (required)
 * @body    {number} [readDuration] - Read duration in seconds (optional)
 * @body    {number} [scrollDepth] - Scroll depth percentage 0-100 (optional)
 * @body    {number} [timeOnPage] - Time on page in seconds (optional)
 * @body    {string} userAgent - User agent string (required)
 * @body    {string} [referrer] - Referrer URL (optional)
 * @body    {string} [ipAddress] - IP address (optional, will use from request if not provided)
 * @body    {string} [country] - Country (optional)
 * @body    {string} deviceType - Device type: desktop, mobile, tablet (required)
 * @body    {string} browser - Browser name (required)
 * @body    {string} os - Operating system (required)
 */
router.post('/blog-read', validateTrackBlogRead, validateRequest, trackBlogRead);

/**
 * @route   GET /api/analytics/summary
 * @desc    Get analytics summary for a workspace
 * @access  Private (workspace member)
 * @query   {string} workspaceId - Workspace ID (required)
 * @query   {string} [start] - Start date for filtering (ISO string)
 * @query   {string} [end] - End date for filtering (ISO string)
 */
router.get(
  '/summary',
  validateAnalyticsSummary,
  validateRequest,
  extractWorkspaceWithoutAuth,
  getAnalyticsSummary,
);

/**
 * @route   GET /api/analytics/blog-posts/:postId
 * @desc    Get blog post specific analytics
 * @access  Private (workspace member)
 * @param   {string} postId - Blog post ID
 * @query   {string} workspaceId - Workspace ID (required)
 */
router.get(
  '/blog-posts/:postId',
  validateBlogPostAnalytics,
  validateRequest,
  extractWorkspaceWithoutAuth,
  getBlogPostAnalytics,
);

/**
 * @route   GET /api/analytics/engagement
 * @desc    Get reader engagement metrics
 * @access  Private (workspace member)
 * @query   {string} workspaceId - Workspace ID (required)
 * @query   {string} [start] - Start date for filtering (ISO string)
 * @query   {string} [end] - End date for filtering (ISO string)
 */
router.get(
  '/engagement',
  validateReaderEngagement,
  validateRequest,
  extractWorkspaceWithoutAuth,
  getReaderEngagement,
);

export default router;
