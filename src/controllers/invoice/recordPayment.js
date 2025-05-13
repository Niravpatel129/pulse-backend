import Invoice from '../../models/invoiceModel.js';
import Payment from '../../models/paymentModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const recordPayment = catchAsync(async (req, res, next) => {
  const { date, amount, method, memo, type = 'payment' } = req.body;
  const invoiceId = req.params.id;

  // Find the invoice
  const invoice = await Invoice.findById(invoiceId);

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Check if the invoice belongs to the user's workspace
  if (invoice.workspace.toString() !== req.workspace._id.toString()) {
    return next(new AppError('You do not have permission to record payment for this invoice', 403));
  }

  // Get all transactions for this invoice
  const transactions = await Payment.find({ invoice: invoiceId })
    .sort({ paymentNumber: -1 })
    .exec();

  // Calculate current balance and available credits
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

  // Validate transaction based on type
  if (amount <= 0) {
    return next(new AppError('Amount must be greater than 0', 400));
  }

  switch (type) {
    case 'payment':
      // Allow overpayment - no validation needed
      break;
    case 'deposit':
      // Deposits can be any amount
      break;
    case 'refund':
      if (!transactions.some((t) => t.type === 'payment' && t.amount >= amount)) {
        return next(new AppError('Refund amount cannot exceed the total payments made', 400));
      }
      break;
    case 'credit':
      // Credits can be any amount
      break;
    case 'adjustment':
      // Adjustments can be positive or negative
      break;
    default:
      return next(new AppError('Invalid transaction type', 400));
  }

  // Calculate new payment number
  const paymentNumber = transactions.length > 0 ? transactions[0].paymentNumber + 1 : 1;

  // Calculate overpayment amount if any
  const overpaymentAmount =
    type === 'payment' && amount > currentBalance ? amount - currentBalance : 0;

  // Create the payment record
  const payment = await Payment.create({
    invoice: invoiceId,
    amount,
    date,
    method,
    memo,
    workspace: req.workspace._id,
    createdBy: req.user.userId,
    paymentNumber,
    remainingBalance: Math.max(0, currentBalance - (type === 'payment' ? amount : 0)),
    previousPayment: transactions[0]?._id,
    type,
    status: 'completed',
  });

  // If there's an overpayment, create a credit record
  let creditRecord = null;
  if (overpaymentAmount > 0) {
    creditRecord = await Payment.create({
      invoice: invoiceId,
      amount: overpaymentAmount,
      date,
      method,
      memo: `Credit from overpayment of ${amount}`,
      workspace: req.workspace._id,
      createdBy: req.user.userId,
      paymentNumber: paymentNumber + 1,
      remainingBalance: 0,
      previousPayment: payment._id,
      type: 'credit',
      status: 'completed',
    });
  }

  // Update invoice status based on new balance
  const newBalance = Math.max(0, currentBalance - (type === 'payment' ? amount : 0));
  if (newBalance <= 0) {
    if (overpaymentAmount > 0) {
      invoice.status = 'overpaid';
    } else {
      invoice.status = 'paid';
    }
    invoice.paidAt = new Date();
    invoice.paidBy = req.user.userId;
  } else if (newBalance < invoice.total) {
    invoice.status = 'partially_paid';
  } else if (invoice.status === 'draft') {
    invoice.status = 'sent';
  }
  await invoice.save();

  // Get all transactions for this invoice
  const allTransactions = await Payment.find({ invoice: invoiceId })
    .sort({ paymentNumber: 1 })
    .populate('createdBy', 'name');

  res.status(201).json({
    status: 'success',
    data: {
      payment,
      creditRecord,
      invoice,
      transactions: allTransactions,
      currentBalance: newBalance,
      availableCredits: availableCredits + overpaymentAmount,
    },
  });
});
