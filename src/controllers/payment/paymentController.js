import asyncHandler from '../../middleware/asyncHandler.js';
import Payment from '../../models/paymentModel.js';
import AppError from '../../utils/AppError.js';

// @desc    Create a new payment
// @route   POST /api/payments
// @access  Private
export const createPayment = asyncHandler(async (req, res, next) => {
  const payment = await Payment.create(req.body);
  res.status(201).json({
    success: true,
    data: payment,
  });
});

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private
export const getPayments = asyncHandler(async (req, res, next) => {
  const workspaceId = req.workspace._id;
  const payments = await Payment.find().populate({
    path: 'invoice',
    populate: {
      path: 'client',
      model: 'Client',
    },
  });

  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments,
  });
});

// @desc    Get single payment
// @route   GET /api/payments/:id
// @access  Private
export const getPaymentById = asyncHandler(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id).populate('invoice').populate('client');

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  res.status(200).json({
    success: true,
    data: payment,
  });
});

// @desc    Update payment
// @route   PUT /api/payments/:id
// @access  Private
export const updatePayment = asyncHandler(async (req, res, next) => {
  const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  res.status(200).json({
    success: true,
    data: payment,
  });
});

// @desc    Delete payment
// @route   DELETE /api/payments/:id
// @access  Private
export const deletePayment = asyncHandler(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  await payment.remove();

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get payments by invoice
// @route   GET /api/payments/invoice/:invoiceId
// @access  Private
export const getPaymentsByInvoice = asyncHandler(async (req, res, next) => {
  const payments = await Payment.find({ invoice: req.params.invoiceId }).populate('client');

  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments,
  });
});

// @desc    Get payments by client
// @route   GET /api/payments/client/:clientId
// @access  Private
export const getPaymentsByClient = asyncHandler(async (req, res, next) => {
  const payments = await Payment.find({ client: req.params.clientId }).populate('invoice');

  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments,
  });
});

// @desc    Process a payment
// @route   POST /api/payments/:id/process
// @access  Private
export const processPayment = asyncHandler(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  // Add payment processing logic here
  // This could involve calling a payment gateway API
  payment.status = 'processed';
  payment.processedAt = Date.now();
  await payment.save();

  res.status(200).json({
    success: true,
    data: payment,
  });
});

// @desc    Refund a payment
// @route   POST /api/payments/:id/refund
// @access  Private
export const refundPayment = asyncHandler(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  // Add refund processing logic here
  // This could involve calling a payment gateway API
  payment.status = 'refunded';
  payment.refundedAt = Date.now();
  await payment.save();

  res.status(200).json({
    success: true,
    data: payment,
  });
});
