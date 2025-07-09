import asyncHandler from '../../middleware/asyncHandler.js';
import NewsletterSignup from '../../models/NewsletterSignup.js';
import AppError from '../../utils/AppError.js';

/**
 * @desc    Get newsletter statistics for a workspace
 * @route   GET /api/newsletter/stats
 * @access  Private (workspace members)
 */
const getNewsletterStats = asyncHandler(async (req, res, next) => {
  const { workspaceId } = req.query;

  // Validate workspace ID
  if (!workspaceId) {
    return next(new AppError('Workspace ID is required', 400));
  }

  // Get basic stats
  const stats = await NewsletterSignup.getWorkspaceStats(workspaceId);

  // Get signups by source
  const sourceStats = await NewsletterSignup.aggregate([
    { $match: { workspaceId: workspaceId } },
    {
      $group: {
        _id: '$source',
        count: { $sum: 1 },
      },
    },
  ]);

  // Get signups by month (last 12 months)
  const monthlyStats = await NewsletterSignup.aggregate([
    { $match: { workspaceId: workspaceId } },
    {
      $group: {
        _id: {
          year: { $year: '$subscribedAt' },
          month: { $month: '$subscribedAt' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 },
  ]);

  // Get recent signups (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentSignups = await NewsletterSignup.countDocuments({
    workspaceId,
    subscribedAt: { $gte: sevenDaysAgo },
  });

  // Format source stats
  const sourceBreakdown = {};
  sourceStats.forEach((stat) => {
    sourceBreakdown[stat._id] = stat.count;
  });

  // Format monthly stats
  const monthlyBreakdown = monthlyStats.map((stat) => ({
    month: `${stat._id.year}-${String(stat._id.month).padStart(2, '0')}`,
    count: stat.count,
  }));

  res.status(200).json({
    success: true,
    data: {
      overview: {
        total: stats.total,
        subscribed: stats.subscribed,
        unsubscribed: stats.unsubscribed,
        pending: stats.pending,
        recentSignups,
      },
      sourceBreakdown,
      monthlyBreakdown,
    },
  });
});

export default getNewsletterStats;
