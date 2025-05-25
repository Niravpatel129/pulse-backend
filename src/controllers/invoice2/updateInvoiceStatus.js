import Invoice2 from '../../models/invoice2.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const updateInvoiceStatus = catchAsync(async (req, res, next) => {
  const { status, reason } = req.body;

  if (!['draft', 'sent', 'paid', 'overdue', 'cancelled'].includes(status)) {
    return next(new AppError('Invalid status value', 400));
  }

  const invoice = await Invoice2.findOne({ _id: req.params.id, workspace: req.workspace._id });

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Don't update if status hasn't changed
  if (invoice.status === status) {
    return res.status(200).json({
      status: 'success',
      data: {
        invoice,
      },
    });
  }

  // Add to status history
  invoice.statusHistory.push({
    status: invoice.status,
    changedAt: new Date(),
    changedBy: req.user.userId,
    reason: reason || `Status changed from ${invoice.status} to ${status}`,
  });

  // Update current status and metadata
  invoice.status = status;
  invoice.statusChangedAt = new Date();
  invoice.statusChangedBy = req.user.userId;

  await invoice.save();

  res.status(200).json({
    status: 'success',
    data: {
      invoice,
    },
  });
});
