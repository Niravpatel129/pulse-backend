import BlogAnalytics from '../../models/BlogAnalytics.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * Get analytics summary for a workspace
 * @route GET /api/analytics/summary
 * @access Private (workspace member)
 */
export const getAnalyticsSummary = asyncHandler(async (req, res) => {
  const { workspaceId } = req.query;
  const { start, end } = req.query;

  if (!workspaceId) {
    return res.status(400).json(new ApiResponse(400, null, 'workspaceId is required'));
  }

  // Build date filter
  const dateFilter = {};
  if (start && end) {
    dateFilter.timestamp = {
      $gte: new Date(start),
      $lte: new Date(end),
    };
  }

  // Get total views and unique readers
  const totalViews = await BlogAnalytics.countDocuments({
    workspaceId,
    ...dateFilter,
  });

  const uniqueReaders = await BlogAnalytics.distinct('sessionId', {
    workspaceId,
    ...dateFilter,
  });

  // Get average read time and scroll depth
  const averages = await BlogAnalytics.aggregate([
    {
      $match: {
        workspaceId: workspaceId,
        ...dateFilter,
      },
    },
    {
      $group: {
        _id: null,
        averageReadTime: { $avg: '$readDuration' },
        averageScrollDepth: { $avg: '$scrollDepth' },
      },
    },
  ]);

  // Get top posts
  const topPosts = await BlogAnalytics.aggregate([
    {
      $match: {
        workspaceId: workspaceId,
        ...dateFilter,
      },
    },
    {
      $group: {
        _id: '$postId',
        postTitle: { $first: '$postTitle' },
        views: { $sum: 1 },
        averageReadTime: { $avg: '$readDuration' },
      },
    },
    {
      $sort: { views: -1 },
    },
    {
      $limit: 10,
    },
  ]);

  // Get reader engagement metrics
  const engagementMetrics = await BlogAnalytics.aggregate([
    {
      $match: {
        workspaceId: workspaceId,
        ...dateFilter,
      },
    },
    {
      $group: {
        _id: null,
        highEngagement: {
          $sum: {
            $cond: [{ $gte: ['$scrollDepth', 70] }, 1, 0],
          },
        },
        mediumEngagement: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ['$scrollDepth', 30] }, { $lt: ['$scrollDepth', 70] }] },
              1,
              0,
            ],
          },
        },
        lowEngagement: {
          $sum: {
            $cond: [{ $lt: ['$scrollDepth', 30] }, 1, 0],
          },
        },
      },
    },
  ]);

  const summary = {
    totalViews,
    uniqueReaders: uniqueReaders.length,
    averageReadTime: averages[0]?.averageReadTime || 0,
    averageScrollDepth: averages[0]?.averageScrollDepth || 0,
    topPosts,
    readerEngagement: {
      highEngagement: engagementMetrics[0]?.highEngagement || 0,
      mediumEngagement: engagementMetrics[0]?.mediumEngagement || 0,
      lowEngagement: engagementMetrics[0]?.lowEngagement || 0,
    },
  };

  res.status(200).json(new ApiResponse(200, summary, 'Analytics summary retrieved successfully'));
});
