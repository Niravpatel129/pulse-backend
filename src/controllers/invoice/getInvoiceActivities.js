import Activity from '../../models/Activity.js';
import catchAsync from '../../utils/catchAsync.js';

export const getInvoiceActivities = catchAsync(async (req, res, next) => {
  try {
    const workspace = req.workspace._id;

    // Get recent invoice activities for the workspace
    const activities = await Activity.find({
      workspace,
      entityType: 'invoice',
    })
      .populate('user', 'name')
      .populate('entityId', 'invoiceNumber')
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      status: 'success',
      results: activities.length,
      data: activities,
    });
  } catch (error) {
    next(error);
  }
});
