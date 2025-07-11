import mongoose from 'mongoose';
import BlogAnalytics from '../../models/BlogAnalytics.js';
import BlogPost from '../../models/BlogPost.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * Enhanced Blog Posts Controller with Analytics Integration
 *
 * This controller now includes comprehensive analytics data for each blog post when:
 * - includeAnalytics=true (default)
 * - Available for both authenticated users and public access
 *
 * Analytics data includes:
 * - Total views and unique visitors
 * - Average engagement metrics (scroll depth, read duration, time on page)
 * - Engagement breakdown (high/medium/low based on scroll depth)
 * - Device and browser breakdown
 * - Recent activity (last 10 sessions)
 *
 * Example response with analytics:
 * {
 *   "_id": "686fff589b407b46630aedd9",
 *   "title": "Swim 60 Minutes Daily to Boost Memory and Brain Health",
 *   "slug": "swim-60-minutes-daily-to-boost-memory-and-brain-health",
 *   "content": "...",
 *   "analytics": {
 *     "totalViews": 150,
 *     "uniqueVisitors": 120,
 *     "avgScrollDepth": 65.5,
 *     "avgReadDuration": 180.2,
 *     "avgTimeOnPage": 240.8,
 *     "engagementBreakdown": {
 *       "high": 45,
 *       "medium": 60,
 *       "low": 45
 *     },
 *     "deviceBreakdown": {
 *       "desktop": 80,
 *       "mobile": 50,
 *       "tablet": 20
 *     },
 *     "browserBreakdown": {
 *       "chrome": 70,
 *       "safari": 40,
 *       "firefox": 25,
 *       "edge": 10,
 *       "other": 5
 *     },
 *     "recentActivity": [
 *       {
 *         "timestamp": "2025-01-15T10:30:00Z",
 *         "sessionId": "session_123",
 *         "scrollDepth": 85,
 *         "readDuration": 300
 *       }
 *     ]
 *   }
 * }
 */

/**
 * Aggregate analytics data for a blog post
 */
const getBlogPostAnalytics = async (postId, workspaceId) => {
  const analytics = await BlogAnalytics.aggregate([
    {
      $match: {
        postId: new mongoose.Types.ObjectId(postId),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      },
    },
    {
      $group: {
        _id: null,
        totalViews: { $sum: 1 },
        totalReadTime: { $sum: '$readDuration' },
        totalTimeOnPage: { $sum: '$timeOnPage' },
        avgScrollDepth: { $avg: '$scrollDepth' },
        avgReadDuration: { $avg: '$readDuration' },
        avgTimeOnPage: { $avg: '$timeOnPage' },
        highEngagementViews: {
          $sum: {
            $cond: [{ $gte: ['$scrollDepth', 70] }, 1, 0],
          },
        },
        mediumEngagementViews: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ['$scrollDepth', 30] }, { $lt: ['$scrollDepth', 70] }] },
              1,
              0,
            ],
          },
        },
        lowEngagementViews: {
          $sum: {
            $cond: [{ $lt: ['$scrollDepth', 30] }, 1, 0],
          },
        },
        uniqueSessions: { $addToSet: '$sessionId' },
        deviceBreakdown: {
          $push: '$deviceType',
        },
        browserBreakdown: {
          $push: '$browser',
        },
        recentActivity: {
          $push: {
            timestamp: '$timestamp',
            sessionId: '$sessionId',
            scrollDepth: '$scrollDepth',
            readDuration: '$readDuration',
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalViews: 1,
        totalReadTime: 1,
        totalTimeOnPage: 1,
        avgScrollDepth: { $round: ['$avgScrollDepth', 2] },
        avgReadDuration: { $round: ['$avgReadDuration', 2] },
        avgTimeOnPage: { $round: ['$avgTimeOnPage', 2] },
        engagementBreakdown: {
          high: '$highEngagementViews',
          medium: '$mediumEngagementViews',
          low: '$lowEngagementViews',
        },
        uniqueVisitors: { $size: '$uniqueSessions' },
        deviceBreakdown: {
          desktop: {
            $size: {
              $filter: {
                input: '$deviceBreakdown',
                cond: { $eq: ['$$this', 'desktop'] },
              },
            },
          },
          mobile: {
            $size: {
              $filter: {
                input: '$deviceBreakdown',
                cond: { $eq: ['$$this', 'mobile'] },
              },
            },
          },
          tablet: {
            $size: {
              $filter: {
                input: '$deviceBreakdown',
                cond: { $eq: ['$$this', 'tablet'] },
              },
            },
          },
        },
        browserBreakdown: {
          chrome: {
            $size: {
              $filter: {
                input: '$browserBreakdown',
                cond: { $regexMatch: { input: '$$this', regex: /chrome/i } },
              },
            },
          },
          safari: {
            $size: {
              $filter: {
                input: '$browserBreakdown',
                cond: { $regexMatch: { input: '$$this', regex: /safari/i } },
              },
            },
          },
          firefox: {
            $size: {
              $filter: {
                input: '$browserBreakdown',
                cond: { $regexMatch: { input: '$$this', regex: /firefox/i } },
              },
            },
          },
          edge: {
            $size: {
              $filter: {
                input: '$browserBreakdown',
                cond: { $regexMatch: { input: '$$this', regex: /edge/i } },
              },
            },
          },
          other: {
            $size: {
              $filter: {
                input: '$browserBreakdown',
                cond: {
                  $not: {
                    $or: [
                      { $regexMatch: { input: '$$this', regex: /chrome/i } },
                      { $regexMatch: { input: '$$this', regex: /safari/i } },
                      { $regexMatch: { input: '$$this', regex: /firefox/i } },
                      { $regexMatch: { input: '$$this', regex: /edge/i } },
                    ],
                  },
                },
              },
            },
          },
        },
        recentActivity: {
          $slice: [
            {
              $sortArray: {
                input: '$recentActivity',
                sortBy: { timestamp: -1 },
              },
            },
            10,
          ],
        },
      },
    },
  ]);

  return (
    analytics[0] || {
      totalViews: 0,
      totalReadTime: 0,
      totalTimeOnPage: 0,
      avgScrollDepth: 0,
      avgReadDuration: 0,
      avgTimeOnPage: 0,
      engagementBreakdown: { high: 0, medium: 0, low: 0 },
      uniqueVisitors: 0,
      deviceBreakdown: { desktop: 0, mobile: 0, tablet: 0 },
      browserBreakdown: { chrome: 0, safari: 0, firefox: 0, edge: 0, other: 0 },
      recentActivity: [],
    }
  );
};

/**
 * Get all blog posts with pagination, filtering, and search
 * Supports both authenticated (workspace from middleware) and public (workspaceId from query) access
 */
export const getAllBlogPosts = asyncHandler(async (req, res) => {
  // Check if workspaceId is provided in query (public access)
  const workspaceId = req.query.workspaceId || req.workspace?._id;

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

  const {
    page = 1,
    limit = 20,
    status,
    search,
    category,
    tag,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    includeAnalytics = 'true', // New parameter to control analytics inclusion
  } = req.query;

  // Build query
  const query = { workspace: workspaceId };

  // // Filter by status - for public access, only show published posts
  // if (req.query.workspaceId) {
  //   // Public access - only published posts
  //   query.status = 'published';
  // } else if (status) {
  //   // Authenticated access - can filter by status
  //   query.status = status;
  // }

  // Filter by category
  if (category) {
    query.categories = { $regex: new RegExp(category, 'i') };
  }

  // Filter by tag
  if (tag) {
    query.tags = { $regex: new RegExp(tag, 'i') };
  }

  // Search functionality
  if (search) {
    query.$text = { $search: search };
  }

  // Pagination
  const pageNumber = parseInt(page, 10);
  const limitNumber = Math.min(parseInt(limit, 10), 50); // Max 50 items per page
  const skip = (pageNumber - 1) * limitNumber;

  // Sort options - for public access, default to publishedAt
  const sortOptions = {};
  const defaultSortBy = req.query.workspaceId ? 'publishedAt' : 'createdAt';
  sortOptions[sortBy || defaultSortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query with pagination
  const blogPosts = await BlogPost.find(query)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email')
    .sort(sortOptions)
    .skip(skip)
    .limit(limitNumber);

  // Get total count for pagination
  const total = await BlogPost.countDocuments(query);
  const totalPages = Math.ceil(total / limitNumber);

  // Add analytics data to each blog post if requested
  let blogPostsWithAnalytics = blogPosts;
  // Include analytics for both authenticated users and public access
  blogPostsWithAnalytics = await Promise.all(
    blogPosts.map(async (post) => {
      const analytics = await getBlogPostAnalytics(post._id, workspaceId);
      return {
        ...post.toObject(),
        analytics,
      };
    }),
  );

  const pagination = {
    page: pageNumber,
    limit: limitNumber,
    total,
    totalPages,
    hasNextPage: pageNumber < totalPages,
    hasPrevPage: pageNumber > 1,
  };

  const message = req.query.workspaceId
    ? 'Public blog posts retrieved successfully'
    : 'Blog posts retrieved successfully';

  res.status(200).json(new ApiResponse(200, blogPostsWithAnalytics, message, { pagination }));
});
