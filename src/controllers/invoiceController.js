import Invoice from '../models/invoiceModel.js';
import AppError from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';

// Generate a unique invoice number
const generateInvoiceNumber = async (workspaceId) => {
  const count = await Invoice.countDocuments({ workspace: workspaceId });
  return `INV-${workspaceId.slice(-4)}-${String(count + 1).padStart(4, '0')}`;
};

// Create a new invoice
export const createInvoice = catchAsync(async (req, res, next) => {
  const { items, client, project, dueDate, notes, paymentTerms, currency } = req.body;

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const tax = subtotal * 0.1; // 10% tax - adjust as needed
  const total = subtotal + tax;

  const invoiceNumber = await generateInvoiceNumber(req.user.workspace);

  const invoice = await Invoice.create({
    invoiceNumber,
    items,
    client,
    project,
    subtotal,
    tax,
    total,
    dueDate,
    notes,
    paymentTerms,
    currency,
    workspace: req.user.workspace,
    createdBy: req.user.id,
  });

  res.status(201).json({
    status: 'success',
    data: invoice,
  });
});

// Get all invoices for a workspace
export const getInvoices = catchAsync(async (req, res, next) => {
  const invoices = await Invoice.find({ workspace: req.user.workspace })
    .populate('client', 'name email')
    .populate('project', 'name')
    .populate('createdBy', 'name');

  res.status(200).json({
    status: 'success',
    results: invoices.length,
    data: invoices,
  });
});

// Get a single invoice
export const getInvoice = catchAsync(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('client', 'name email')
    .populate('project', 'name')
    .populate('createdBy', 'name');

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Check if the invoice belongs to the user's workspace
  if (invoice.workspace.toString() !== req.user.workspace.toString()) {
    return next(new AppError('You do not have permission to view this invoice', 403));
  }

  res.status(200).json({
    status: 'success',
    data: invoice,
  });
});

// Update an invoice
export const updateInvoice = catchAsync(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Check if the invoice belongs to the user's workspace
  if (invoice.workspace.toString() !== req.user.workspace.toString()) {
    return next(new AppError('You do not have permission to update this invoice', 403));
  }

  // Only allow updates to draft invoices
  if (invoice.status !== 'draft') {
    return next(new AppError('Can only update draft invoices', 400));
  }

  const updatedInvoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: updatedInvoice,
  });
});

// Delete an invoice
export const deleteInvoice = catchAsync(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return next(new AppError('No invoice found with that ID', 404));
  }

  // Check if the invoice belongs to the user's workspace
  if (invoice.workspace.toString() !== req.user.workspace.toString()) {
    return next(new AppError('You do not have permission to delete this invoice', 403));
  }

  // Only allow deletion of draft invoices
  if (invoice.status !== 'draft') {
    return next(new AppError('Can only delete draft invoices', 400));
  }

  await Invoice.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Send invoice to client
export const sendInvoice = catchAsync(async (req, res, next) => {
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

  // TODO: Implement email sending logic here
  // For now, just update the status
  invoice.status = 'sent';
  await invoice.save();

  res.status(200).json({
    status: 'success',
    data: invoice,
  });
});

// Mark invoice as paid
export const markAsPaid = catchAsync(async (req, res, next) => {
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

  invoice.status = 'paid';
  await invoice.save();

  res.status(200).json({
    status: 'success',
    data: invoice,
  });
});
