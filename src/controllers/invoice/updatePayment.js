import Invoice from '../../models/invoiceModel.js';
import Payment from '../../models/paymentModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const updatePayment = catchAsync(async (req, res, next) => {
  const { id: invoiceId, paymentId } = req.params;
  const { date, amount, method, memo, type } = req.body;

  // Find the invoice
  const invoice = await Invoice.findById(invoiceId);

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Check if the invoice belongs to the user's workspace
  if (invoice.workspace.toString() !== req.workspace._id.toString()) {
    return next(
      new AppError('You do not have permission to update payments for this invoice', 403),
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

  // Validate amount if provided
  if (amount !== undefined && amount <= 0) {
    return next(new AppError('Amount must be greater than 0', 400));
  }

  // Get all transactions for this invoice
  const transactions = await Payment.find({ invoice: invoiceId }).sort({ paymentNumber: 1 }).exec();

  // Calculate current balance excluding the payment being updated
  let currentBalance = invoice.total;
  let availableCredits = 0;

  transactions.forEach((transaction) => {
    if (transaction._id.toString() === paymentId) return; // Skip the payment being updated

    if (transaction.type === 'payment' || transaction.type === 'deposit') {
      currentBalance -= transaction.amount;
    } else if (transaction.type === 'credit') {
      availableCredits += transaction.amount;
    } else if (transaction.type === 'refund') {
      currentBalance += transaction.amount;
    }
  });

  // Validate new amount if type is refund
  if (type === 'refund' && amount) {
    const totalPayments = transactions.reduce((sum, t) => {
      if (t._id.toString() === paymentId) return sum;
      return sum + (t.type === 'payment' ? t.amount : 0);
    }, 0);

    if (amount > totalPayments) {
      return next(new AppError('Refund amount cannot exceed the total payments made', 400));
    }
  }

  // Update the payment
  const updatedPayment = await Payment.findByIdAndUpdate(
    paymentId,
    {
      ...(date && { date }),
      ...(amount && { amount }),
      ...(method && { method }),
      ...(memo && { memo }),
      ...(type && { type }),
    },
    { new: true, runValidators: true },
  );

  // Recalculate final balance including the updated payment
  currentBalance = invoice.total;
  availableCredits = 0;

  transactions.forEach((transaction) => {
    if (transaction._id.toString() === paymentId) {
      // Use the updated payment amount
      if (updatedPayment.type === 'payment' || updatedPayment.type === 'deposit') {
        currentBalance -= updatedPayment.amount;
      } else if (updatedPayment.type === 'credit') {
        availableCredits += updatedPayment.amount;
      } else if (updatedPayment.type === 'refund') {
        currentBalance += updatedPayment.amount;
      }
    } else {
      if (transaction.type === 'payment' || transaction.type === 'deposit') {
        currentBalance -= transaction.amount;
      } else if (transaction.type === 'credit') {
        availableCredits += transaction.amount;
      } else if (transaction.type === 'refund') {
        currentBalance += transaction.amount;
      }
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

  // Get updated transactions list
  const updatedTransactions = await Payment.find({ invoice: invoiceId })
    .sort({ paymentNumber: 1 })
    .populate('createdBy', 'name');

  res.status(200).json({
    status: 'success',
    data: {
      payment: updatedPayment,
      invoice,
      transactions: updatedTransactions,
      currentBalance,
      availableCredits,
    },
  });
});
