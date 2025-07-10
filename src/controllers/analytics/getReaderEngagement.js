import BlogAnalytics from '../../models/BlogAnalytics.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * Get reader engagement metrics
 * @route GET /api/analytics/engagement
 * @access Private (workspace member)
 */
export const getReaderEngagement = asyncHandler(async (req, res) => {
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

  // Get total sessions
  const totalSessions = await BlogAnalytics.distinct('sessionId', {
    workspaceId,
    ...dateFilter,
  });

  // Get average session duration
  const sessionDuration = await BlogAnalytics.aggregate([
    {
      $match: {
        workspaceId: workspaceId,
        ...dateFilter,
      },
    },
    {
      $group: {
        _id: '$sessionId',
        totalTimeOnPage: { $sum: '$timeOnPage' },
      },
    },
    {
      $group: {
        _id: null,
        averageSessionDuration: { $avg: '$totalTimeOnPage' },
      },
    },
  ]);

  // Calculate bounce rate (sessions with only one page view)
  const sessionPageCounts = await BlogAnalytics.aggregate([
    {
      $match: {
        workspaceId: workspaceId,
        ...dateFilter,
      },
    },
    {
      $group: {
        _id: '$sessionId',
        pageCount: { $sum: 1 },
      },
    },
  ]);

  const bouncedSessions = sessionPageCounts.filter((session) => session.pageCount === 1).length;
  const bounceRate = totalSessions.length > 0 ? (bouncedSessions / totalSessions.length) * 100 : 0;

  // Get return readers (sessions that appear multiple times)
  const sessionFrequency = await BlogAnalytics.aggregate([
    {
      $match: {
        workspaceId: workspaceId,
        ...dateFilter,
      },
    },
    {
      $group: {
        _id: '$sessionId',
        visitCount: { $sum: 1 },
      },
    },
  ]);

  const returnReaders = sessionFrequency.filter((session) => session.visitCount > 1).length;
  const newReaders = sessionFrequency.filter((session) => session.visitCount === 1).length;

  const engagement = {
    totalSessions: totalSessions.length,
    averageSessionDuration: sessionDuration[0]?.averageSessionDuration || 0,
    bounceRate: Math.round(bounceRate * 100) / 100, // Round to 2 decimal places
    returnReaders,
    newReaders,
  };

  res
    .status(200)
    .json(new ApiResponse(200, engagement, 'Reader engagement metrics retrieved successfully'));
});
