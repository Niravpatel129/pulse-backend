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
    if (invoice.status !== 'sent') {
      return next(new AppError('Can only mark sent invoices as paid', 400));
    }

    // Update invoice status
    invoice.status = 'paid';
    invoice.paidAt = new Date();
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
