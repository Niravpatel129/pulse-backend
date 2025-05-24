import Invoice2 from '../../models/invoice2.js';
import catchAsync from '../../utils/catchAsync.js';

export const validateInvoiceNumber = catchAsync(async (req, res, next) => {
  const { invoiceNumber } = req.params;

  if (!invoiceNumber) {
    return res.status(400).json({
      status: 'error',
      message: 'Invoice number is required',
    });
  }

  const existingInvoice = await Invoice2.findOne({
    invoiceNumber,
    workspace: req.workspace._id,
  });

  res.status(200).json({
    status: 'success',
    data: {
      isAvailable: !existingInvoice,
    },
  });
});
