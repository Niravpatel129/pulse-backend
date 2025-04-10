import Invoice from '../../models/invoiceModel.js';
import catchAsync from '../../utils/catchAsync.js';
import { generateInvoiceNumber } from './generateInvoiceNumber.js';

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
