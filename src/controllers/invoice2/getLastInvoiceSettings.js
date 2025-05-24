import Invoice2 from '../../models/invoice2.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const getLastInvoiceSettings = catchAsync(async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;

    if (!workspaceId) {
      return next(new AppError('Workspace ID is required', 400));
    }

    // Find the most recent invoice for this workspace
    const lastInvoice = await Invoice2.findOne({ workspace: workspaceId })
      .sort({ createdAt: -1 })
      .select('currency taxRate taxId showTaxId deliveryOptions notes paymentTerms');

    if (!lastInvoice) {
      return next(new AppError('No invoices found for this workspace', 404));
    }

    // Extract relevant settings from the last invoice
    const invoiceSettings = {
      currency: lastInvoice.currency,
      taxRate: lastInvoice.taxRate,
      taxId: lastInvoice.taxId,
      showTaxId: lastInvoice.showTaxId,
      deliveryOptions: lastInvoice.deliveryOptions,
      notes: lastInvoice.notes,
      paymentTerms: lastInvoice.paymentTerms,
    };

    res.status(200).json({
      status: 'success',
      data: {
        invoiceSettings,
      },
    });
  } catch (error) {
    next(error);
  }
});
