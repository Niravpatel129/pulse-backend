import Invoice from '../../models/invoiceModel.js';
import catchAsync from '../../utils/catchAsync.js';

export const getInvoices = catchAsync(async (req, res, next) => {
  try {
    const workspace = req.workspace._id;
    const invoices = await Invoice.find({ workspace })
      .populate('client')
      .populate('project', 'name description')
      .populate('items', 'name quantity price projects modules discount')
      .populate('createdBy', 'name')
      .populate('teamNotesAttachments')
      .select(
        'invoiceNumber total status dueDate notes createdAt project modules items currency status archived starred dateSent datePaid',
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: invoices.length,
      data: invoices,
    });
  } catch (error) {
    next(error);
  }
});
