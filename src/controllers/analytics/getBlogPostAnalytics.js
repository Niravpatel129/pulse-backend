import BlogAnalytics from '../../models/BlogAnalytics.js';
import BlogPost from '../../models/BlogPost.js';
import ApiResponse from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/**
 * Get blog post specific analytics
 * @route GET /api/analytics/blog-posts/:postId
 * @access Private (workspace member)
 */
export const getBlogPostAnalytics = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { workspaceId } = req.query;

  if (!workspaceId) {
    return res.status(400).json(new ApiResponse(400, null, 'workspaceId is required'));
  }

  // Verify the blog post exists and belongs to the workspace
  const blogPost = await BlogPost.findOne({ _id: postId, workspace: workspaceId });
  if (!blogPost) {
    return res
      .status(404)
      .json(
        new ApiResponse(
          404,
          null,
          'Blog post not found or does not belong to the specified workspace',
        ),
      );
  }

  // Get total views and unique readers
  const totalViews = await BlogAnalytics.countDocuments({
    postId,
    workspaceId,
  });

  const uniqueReaders = await BlogAnalytics.distinct('sessionId', {
    postId,
    workspaceId,
  });

  // Get average read time and scroll depth
  const averages = await BlogAnalytics.aggregate([
    {
      $match: {
        postId: postId,
        workspaceId: workspaceId,
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

  // Get read history (last 50 reads)
  const readHistory = await BlogAnalytics.find({
    postId,
    workspaceId,
  })
    .select('timestamp readDuration scrollDepth')
    .sort({ timestamp: -1 })
    .limit(50)
    .lean();

  const analytics = {
    totalViews,
    uniqueReaders: uniqueReaders.length,
    averageReadTime: averages[0]?.averageReadTime || 0,
    averageScrollDepth: averages[0]?.averageScrollDepth || 0,
    readHistory: readHistory.map((record) => ({
      timestamp: record.timestamp.toISOString(),
      readDuration: record.readDuration,
      scrollDepth: record.scrollDepth,
    })),
  };

  res
    .status(200)
    .json(new ApiResponse(200, analytics, 'Blog post analytics retrieved successfully'));
});
