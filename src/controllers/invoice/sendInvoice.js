import Activity from '../../models/Activity.js';
import Invoice from '../../models/invoiceModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const sendInvoice = catchAsync(async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return next(new AppError('No invoice found with that ID', 404));
    }

    // Check if the invoice belongs to the user's workspace
    if (invoice.workspace.toString() !== req.user.workspace.toString()) {
      return next(new AppError('You do not have permission to send this invoice', 403));
    }

    // Only allow sending draft invoices
    if (invoice.status !== 'draft') {
      return next(new AppError('Can only send draft invoices', 400));
    }

    // Add timeline entry for sent invoice
    const timelineEntry = {
      type: 'sent',
      timestamp: new Date(),
      actor: req.user.userId,
      description: `Invoice sent to client`,
      metadata: {
        previousStatus: invoice.status,
        newStatus: 'sent',
        sentBy: req.user.name || req.user.email || req.user.userId,
        sentVia: req.body.deliveryMethod || 'email',
      },
    };

    invoice.timeline.push(timelineEntry);

    // Add status change timeline entry
    const statusChangeEntry = {
      type: 'status_change',
      timestamp: new Date(),
      actor: req.user.userId,
      description: `Invoice status changed from ${invoice.status} to sent`,
      metadata: {
        previousStatus: invoice.status,
        newStatus: 'sent',
      },
    };

    invoice.timeline.push(statusChangeEntry);

    // Update invoice status
    invoice.status = 'sent';
    invoice.dateSent = new Date();
    await invoice.save();

    // Record activity
    await Activity.create({
      user: req.user.userId,
      workspace: req.workspace._id,
      type: 'invoice',
      action: 'sent',
      description: `Invoice #${invoice.invoiceNumber} sent to client`,
      entityId: invoice._id,
      entityType: 'invoice',
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        status: 'sent',
      },
    });

    res.status(200).json({
      status: 'success',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
});
