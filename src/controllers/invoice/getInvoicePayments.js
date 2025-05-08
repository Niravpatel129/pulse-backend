import Invoice from '../../models/invoiceModel.js';
import Payment from '../../models/paymentModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const getInvoicePayments = catchAsync(async (req, res, next) => {
  const invoiceId = req.params.id;

  // Find the invoice
  const invoice = await Invoice.findById(invoiceId);

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Check if the invoice belongs to the user's workspace
  if (invoice.workspace.toString() !== req.workspace._id.toString()) {
    return next(new AppError('You do not have permission to view payments for this invoice', 403));
  }

  // Get all transactions for this invoice
  const transactions = await Payment.find({ invoice: invoiceId })
    .sort({ paymentNumber: 1 })
    .populate('createdBy', 'name');

  // Calculate running balance and available credits
  let runningBalance = invoice.total;
  let availableCredits = 0;
  const paymentHistory = transactions.map((transaction) => {
    let balanceAfter = runningBalance;

    if (transaction.type === 'payment' || transaction.type === 'deposit') {
      balanceAfter = Math.max(0, runningBalance - transaction.amount);
      runningBalance = balanceAfter;
    } else if (transaction.type === 'credit') {
      availableCredits += transaction.amount;
    } else if (transaction.type === 'refund') {
      balanceAfter = runningBalance + transaction.amount;
      runningBalance = balanceAfter;
    }

    return {
      ...transaction.toObject(),
      balanceBefore: runningBalance + (transaction.type === 'payment' ? transaction.amount : 0),
      balanceAfter,
    };
  });

  res.status(200).json({
    status: 'success',
    data: {
      invoice: {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        status: invoice.status,
        paidAt: invoice.paidAt,
      },
      paymentHistory,
      currentBalance: runningBalance,
      availableCredits,
    },
  });
});
