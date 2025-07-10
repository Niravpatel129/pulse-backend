import asyncHandler from '../../middleware/asyncHandler.js';
import NewsletterSignup from '../../models/NewsletterSignup.js';

/**
 * @desc    Get newsletter subscriber summary for a workspace
 * @route   GET /api/newsletter/subscribers/summary
 * @access  Private (workspace members)
 */
const getSubscriberSummary = asyncHandler(async (req, res, next) => {
  const workspaceId = req.workspace._id;

  // Get subscriber counts by status
  const statusStats = await NewsletterSignup.aggregate([
    { $match: { workspaceId: workspaceId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  // Initialize counts
  const summary = {
    active: 0,
    unsubscribed: 0,
    pending: 0,
    total: 0,
  };

  // Map status counts
  statusStats.forEach((stat) => {
    switch (stat._id) {
      case 'subscribed':
        summary.active = stat.count;
        break;
      case 'unsubscribed':
        summary.unsubscribed = stat.count;
        break;
      case 'pending':
        summary.pending = stat.count;
        break;
    }
    summary.total += stat.count;
  });

  // Calculate engagement metrics (placeholder - you can enhance this based on your needs)
  const engagementMetrics = {
    avgOpenRate: 25, // Example: you can calculate this from email analytics
    avgClickRate: 3, // Example: you can calculate this from email analytics
    engagementScore: 'Good', // Calculated based on open/click rates
    numericScore: 6, // 0-10 scale
  };

  res.status(200).json({
    success: true,
    data: {
      summary,
      engagement: engagementMetrics,
    },
  });
});

export default getSubscriberSummary;
