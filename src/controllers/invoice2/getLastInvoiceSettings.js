import Invoice2 from '../../models/invoice2.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';
import { generateInvoice2Number } from '../../utils/generateInvoice2Number.js';

export const getLastInvoiceSettings = catchAsync(async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;

    if (!workspaceId) {
      return next(new AppError('Workspace ID is required', 400));
    }

    // Find the most recent invoice for this workspace
    const lastInvoice = await Invoice2.findOne({ workspace: workspaceId })
      .sort({ createdAt: -1 })
      .select('settings notes logo from');

    if (!lastInvoice) {
      return next(new AppError('No invoices found for this workspace', 404));
    }

    // Generate the next invoice number
    const newInvoiceNumber = await generateInvoice2Number(workspaceId);

    // Extract relevant settings from the last invoice
    const invoiceSettings = {
      currency: lastInvoice.settings.currency,
      dateFormat: lastInvoice.settings.dateFormat,
      salesTax: {
        enabled: lastInvoice.settings.salesTax.enabled,
        rate: lastInvoice.settings.salesTax.rate,
      },
      vat: {
        enabled: lastInvoice.settings.vat.enabled,
        rate: lastInvoice.settings.vat.rate,
      },
      discount: {
        enabled: lastInvoice.settings.discount.enabled,
        amount: lastInvoice.settings.discount.amount,
      },
      decimals: lastInvoice.settings.decimals,
      notes: lastInvoice.notes,
      logo: lastInvoice.logo,
      from: lastInvoice.from,
      newInvoiceNumber,
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
