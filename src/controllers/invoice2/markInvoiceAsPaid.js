import Invoice2 from '../../models/invoice2.js';
import AppError from '../../utils/AppError.js';

export const markInvoiceAsPaid = async (req, res, next) => {
  const { id } = req.params;
  const { paymentDate, paymentMethod } = req.body;

  if (!paymentDate) {
    return next(new AppError('Payment date is required', 400));
  }

  // Validate payment date is not in the future
  const paymentDateObj = new Date(paymentDate);
  if (paymentDateObj > new Date()) {
    return next(new AppError('Payment date cannot be in the future', 400));
  }

  // Validate payment method
  const validPaymentMethods = ['bank_transfer', 'credit_card', 'cash', 'check', 'other'];
  if (paymentMethod && !validPaymentMethods.includes(paymentMethod)) {
    return next(
      new AppError(
        `Invalid payment method. Must be one of: ${validPaymentMethods.join(', ')}`,
        400,
      ),
    );
  }

  const invoice = await Invoice2.findOne({ _id: id, workspace: req.workspace._id });

  if (!invoice) {
    return next(new AppError('Invoice not found', 404));
  }

  // Don't allow marking already paid or cancelled invoices as paid
  if (invoice.status === 'paid') {
    return next(new AppError('Invoice is already marked as paid', 400));
  }
  if (invoice.status === 'cancelled') {
    return next(new AppError('Cannot mark a cancelled invoice as paid', 400));
  }

  invoice.status = 'paid';
  invoice.paymentDate = paymentDate;
  invoice.paymentMethod = paymentMethod || 'bank_transfer';
  invoice.paidAt = new Date();
  invoice.statusChangedAt = new Date();
  invoice.statusChangedBy = req.user.userId;

  // Add to status history
  invoice.statusHistory.push({
    status: 'paid',
    changedAt: new Date(),
    changedBy: req.user.userId,
    reason: 'Invoice marked as paid',
  });

  await invoice.save();

  res.status(200).json({
    success: true,
    data: invoice,
  });
};
