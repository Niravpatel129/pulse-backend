import Invoice from '../../models/invoiceModel.js';
import ProductCatalog from '../../models/ProductCatalog.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';
import { generateInvoiceNumber } from '../../utils/generateInvoiceNumber.js';

export const createInvoice = catchAsync(async (req, res, next) => {
  try {
    const { clientId, itemIds, status = 'open', deliveryMethod = 'email' } = req.body;

    if (!clientId) {
      return next(new AppError('Client ID is required', 400));
    }

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return next(new AppError('At least one product catalog item is required', 400));
    }

    // Fetch product catalog items
    const products = await ProductCatalog.find({ _id: { $in: itemIds } });

    if (products.length !== itemIds.length) {
      return next(new AppError('One or more product catalog items not found', 404));
    }

    // Calculate totals
    const subtotal = products.reduce((sum, product) => sum + product.price * product.quantity, 0);
    const total = subtotal; // You can add tax or other calculations here if needed

    const invoiceNumber = await generateInvoiceNumber(req.workspace._id);

    const invoice = await Invoice.create({
      invoiceNumber,
      client: clientId,
      items: itemIds,
      subtotal,
      total,
      status,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      currency: 'USD',
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
