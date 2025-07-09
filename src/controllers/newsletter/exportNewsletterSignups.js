import asyncHandler from '../../middleware/asyncHandler.js';
import newsletterService from '../../services/newsletterService.js';
import AppError from '../../utils/AppError.js';

/**
 * @desc    Export newsletter signups for a workspace
 * @route   GET /api/newsletter/export
 * @access  Private (workspace admins)
 */
const exportNewsletterSignups = asyncHandler(async (req, res, next) => {
  const { workspaceId, format = 'json' } = req.query;

  // Validate workspace ID
  if (!workspaceId) {
    return next(new AppError('Workspace ID is required', 400));
  }

  // Get signups data
  const signups = await newsletterService.exportSignups(workspaceId);

  if (format === 'csv') {
    // Convert to CSV format
    const csvHeaders = [
      'Email',
      'Workspace Name',
      'Source',
      'Status',
      'Subscribed At',
      'Unsubscribed At',
    ];
    const csvRows = signups.map((signup) => [
      signup.email,
      signup.workspaceName,
      signup.source,
      signup.status,
      signup.subscribedAt ? new Date(signup.subscribedAt).toISOString() : '',
      signup.unsubscribedAt ? new Date(signup.unsubscribedAt).toISOString() : '',
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map((row) => row.map((field) => `"${field}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="newsletter-signups-${workspaceId}-${
        new Date().toISOString().split('T')[0]
      }.csv"`,
    );

    return res.send(csvContent);
  }

  // Default JSON format
  res.status(200).json({
    success: true,
    data: {
      workspaceId,
      totalSignups: signups.length,
      signups,
      exportedAt: new Date().toISOString(),
    },
  });
});

export default exportNewsletterSignups;
