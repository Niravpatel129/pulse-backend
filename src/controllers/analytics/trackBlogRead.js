import BlogAnalytics from '../../models/BlogAnalytics.js';
import BlogPost from '../../models/BlogPost.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { parseUserAgent } from '../../utils/deviceDetection.js';

/**
 * Track a blog post read/view
 * @route POST /api/analytics/blog-read
 * @access Public (no authentication required)
 */
export const trackBlogRead = asyncHandler(async (req, res) => {
  const {
    postId,
    postTitle,
    readerId,
    sessionId,
    readDuration,
    scrollDepth,
    timeOnPage,
    userAgent,
    referrer,
    ipAddress,
    country,
    deviceType,
    browser,
    os,
  } = req.body;

  // Validate required fields
  if (!postId || !sessionId || !userAgent) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, 'Missing required fields: postId, sessionId, userAgent'));
  }

  // Validate scroll depth range if provided
  if (scrollDepth !== undefined && (scrollDepth < 0 || scrollDepth > 100)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, 'Scroll depth must be between 0 and 100'));
  }

  // Validate device type if provided
  if (deviceType && !['desktop', 'mobile', 'tablet'].includes(deviceType)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, 'Device type must be desktop, mobile, or tablet'));
  }

  // Get the blog post and extract workspaceId from it
  const blogPost = await BlogPost.findById(postId);
  if (!blogPost) {
    return res.status(404).json(new ApiResponse(404, null, 'Blog post not found'));
  }

  // Parse user agent to get device information if not provided
  const deviceInfo = parseUserAgent(userAgent);
  const finalDeviceType = deviceType || deviceInfo.deviceType;
  const finalBrowser = browser || deviceInfo.browser;
  const finalOS = os || deviceInfo.os;

  // Create analytics record
  const analyticsRecord = new BlogAnalytics({
    postId,
    postTitle: postTitle || blogPost.title,
    workspaceId: blogPost.workspace, // Extract from blog post
    readerId,
    sessionId,
    readDuration: readDuration || 0,
    scrollDepth: scrollDepth || 0,
    timeOnPage: timeOnPage || 0,
    userAgent,
    referrer,
    ipAddress: ipAddress || req.ip,
    country,
    deviceType: finalDeviceType,
    browser: finalBrowser,
    os: finalOS,
  });

  await analyticsRecord.save();

  res
    .status(200)
    .json(new ApiResponse(200, { success: true }, 'Blog read analytics tracked successfully'));
});
