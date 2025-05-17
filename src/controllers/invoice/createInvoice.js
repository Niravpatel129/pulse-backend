import Activity from '../../models/Activity.js';
import Invoice from '../../models/invoiceModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';
import { generateInvoiceNumber } from '../../utils/generateInvoiceNumber.js';

export const createInvoice = catchAsync(async (req, res, next) => {
  try {
    const {
      clientId,
      items,
      dueDate,
      taxRate,
      taxId,
      showTaxId = false,
      notes,
      teamNotes,
      teamNotesAttachments = [],
      currency = 'usd',
      deliveryOptions = 'email',
      requireDeposit = false,
      depositPercentage = 50,
      discount = 0,
      discountAmount = 0,
      status = 'open',
    } = req.body;

    if (!clientId) {
      return next(new AppError('Client ID is required', 400));
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return next(new AppError('At least one item is required', 400));
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalDiscount =
      discountAmount || items.reduce((sum, item) => sum + (item.discount || 0), 0);

    // Use provided taxAmount if available, otherwise calculate
    const totalTax =
      req.body.taxAmount ||
      items.reduce((sum, item) => {
        const itemSubtotal = item.price * item.quantity;
        const itemDiscount = item.discount || 0;
        const taxableAmount = itemSubtotal - itemDiscount;
        return sum + taxableAmount * (taxRate / 100);
      }, 0);

    const total = subtotal - totalDiscount + totalTax;

    const invoiceNumber = await generateInvoiceNumber(req.workspace._id);

    const invoice = await Invoice.create({
      invoiceNumber,
      client: clientId,
      items,
      subtotal,
      total,
      discount: totalDiscount,
      discountAmount,
      tax: totalTax,
      taxRate,
      taxId,
      showTaxId,
      notes,
      teamNotes,
      teamNotesAttachments,
      status,
      dueDate: dueDate ? new Date(dueDate) : null,
      currency: currency.toUpperCase(),
      deliveryOptions,
      requireDeposit,
      depositPercentage,
      workspace: req.workspace._id,
      createdBy: req.user.userId,
    });

    // Record activity
    await Activity.create({
      user: req.user.userId,
      workspace: req.workspace._id,
      type: 'invoice',
      action: 'created',
      description: `Invoice #${invoiceNumber} created`,
      entityId: invoice._id,
      entityType: 'invoice',
      metadata: {
        invoiceNumber,
        total,
        status,
      },
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
