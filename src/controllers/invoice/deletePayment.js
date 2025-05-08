import Invoice from '../../models/invoiceModel.js';
import Payment from '../../models/paymentModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const deletePayment = catchAsync(async (req, res, next) => {
  const { id: invoiceId, paymentId } = req.params;

  // Find the invoice
  const invoice = await Invoice.findById(invoiceId);

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Check if the invoice belongs to the user's workspace
  if (invoice.workspace.toString() !== req.workspace._id.toString()) {
    return next(
      new AppError('You do not have permission to delete payments for this invoice', 403),
    );
  }

  // Find the payment
  const payment = await Payment.findById(paymentId);

  if (!payment) {
    return next(new AppError('No payment found with that ID', 404));
  }

  // Check if the payment belongs to the invoice
  if (payment.invoice.toString() !== invoiceId) {
    return next(new AppError('Payment does not belong to this invoice', 400));
  }

  // Delete the payment
  await Payment.findByIdAndDelete(paymentId);

  // Get all remaining transactions for this invoice
  const transactions = await Payment.find({ invoice: invoiceId }).sort({ paymentNumber: 1 }).exec();

  // Recalculate current balance
  let currentBalance = invoice.total;
  let availableCredits = 0;

  transactions.forEach((transaction) => {
    if (transaction.type === 'payment' || transaction.type === 'deposit') {
      currentBalance -= transaction.amount;
    } else if (transaction.type === 'credit') {
      availableCredits += transaction.amount;
    } else if (transaction.type === 'refund') {
      currentBalance += transaction.amount;
    }
  });

  // Update invoice status based on new balance
  if (currentBalance <= 0) {
    invoice.status = 'paid';
    invoice.paidAt = new Date();
    invoice.paidBy = req.user.userId;
  } else if (invoice.status === 'paid') {
    invoice.status = 'sent';
    invoice.paidAt = undefined;
    invoice.paidBy = undefined;
  }
  await invoice.save();

  res.status(200).json({
    status: 'success',
    data: {
      invoice,
      transactions,
      currentBalance,
      availableCredits,
    },
  });
});
