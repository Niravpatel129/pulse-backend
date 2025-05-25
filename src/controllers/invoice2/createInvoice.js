import Invoice2 from '../../models/invoice2.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const createInvoice = catchAsync(async (req, res, next) => {
  try {
    const { invoiceNumber } = req.body;

    // Check if invoice number is provided
    if (!invoiceNumber) {
      return next(new AppError('Invoice number is required', 400));
    }

    // Check if invoice number already exists in the workspace
    const existingInvoice = await Invoice2.findOne({
      invoiceNumber,
      workspace: req.workspace._id,
    });

    if (existingInvoice) {
      return next(new AppError('Invoice number already exists', 400));
    }

    const invoice = await Invoice2.create({
      ...req.body,
      status: 'open',
      workspace: req.workspace._id,
      createdBy: req.user.userId,
    });

    res.status(201).json({
      status: 'success',
      data: {
        invoice,
      },
    });

    console.log('Invoice created:', invoice);
  } catch (error) {
    console.error('Error creating invoice:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create invoice',
    });
  }
});
