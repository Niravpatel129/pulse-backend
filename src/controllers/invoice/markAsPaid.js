import Activity from '../../models/Activity.js';
import Invoice from '../../models/invoiceModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const markAsPaid = catchAsync(async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return next(new AppError('No invoice found with that ID', 404));
    }

    // Check if the invoice belongs to the user's workspace
    if (invoice.workspace.toString() !== req.user.workspace.toString()) {
      return next(new AppError('You do not have permission to mark this invoice as paid', 403));
    }

    // Only allow marking sent invoices as paid
    if (invoice.status !== 'sent' && invoice.status !== 'overdue') {
      return next(new AppError('Can only mark sent or overdue invoices as paid', 400));
    }

    // Add payment timeline entry
    const paymentEntry = {
      type: 'payment_succeeded',
      timestamp: new Date(),
      actor: req.user.userId,
      description: `Invoice marked as paid manually by ${
        req.user.name || req.user.email || 'staff member'
      }`,
      metadata: {
        paymentMethod: req.body.paymentMethod || 'manual',
        amount: invoice.total,
        currency: invoice.currency,
        previousStatus: invoice.status,
        newStatus: 'paid',
        markedPaidBy: req.user.name || req.user.email || req.user.userId,
      },
    };

    invoice.timeline.push(paymentEntry);

    // Add status change timeline entry
    const statusChangeEntry = {
      type: 'status_change',
      timestamp: new Date(),
      actor: req.user.userId,
      description: `Invoice status changed from ${invoice.status} to paid`,
      metadata: {
        previousStatus: invoice.status,
        newStatus: 'paid',
      },
    };

    invoice.timeline.push(statusChangeEntry);

    // Update invoice status
    invoice.status = 'paid';
    invoice.paidAt = new Date();
    invoice.datePaid = new Date();
    invoice.paidBy = req.user.userId;
    await invoice.save();

    // Record activity
    await Activity.create({
      user: req.user.userId,
      workspace: req.workspace._id,
      type: 'invoice',
      action: 'paid',
      description: `Invoice #${invoice.invoiceNumber} marked as paid`,
      entityId: invoice._id,
      entityType: 'invoice',
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        status: 'paid',
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
