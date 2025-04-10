import Invoice from '../../models/invoiceModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';
import { generateInvoiceNumber } from '../../utils/generateInvoiceNumber.js';

export const createInvoice = catchAsync(async (req, res, next) => {
  try {
    const {
      clientId,
      items,
      subtotal,
      total,
      status = 'draft',
      dueDate,
      notes,
      paymentTerms,
      currency = 'USD',
      deliveryMethod = 'email',
    } = req.body;

    if (!clientId) {
      return next(new AppError('Client ID is required', 400));
    }

    const invoiceNumber = await generateInvoiceNumber(req.workspace._id);

    if (!items || !Array.isArray(items) || items.length === 0) {
      return next(new AppError('At least one item is required', 400));
    }

    const transformedItems = items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.total || item.amount,
    }));

    const calculatedSubtotal =
      subtotal || transformedItems.reduce((sum, item) => sum + item.amount, 0);
    const calculatedTotal = total || calculatedSubtotal;

    const invoice = await Invoice.create({
      invoiceNumber,
      client: clientId,
      items: transformedItems,
      subtotal: calculatedSubtotal,
      total: calculatedTotal,
      status,
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes,
      paymentTerms,
      currency,
      deliveryMethod,
      workspace: req.workspace._id,
      createdBy: req.user.userId,
    });

    res.status(201).json({
      status: 'success',
      data: invoice,
    });
  } catch (error) {
    console.log('Error creating invoice:', error);
    next(error);
  }
});
