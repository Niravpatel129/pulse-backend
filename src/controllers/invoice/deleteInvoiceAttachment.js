import Invoice from '../../models/invoiceModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const deleteInvoiceAttachment = catchAsync(async (req, res, next) => {
  try {
    const { id, attachmentId } = req.params;

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return next(new AppError('No invoice found with that ID', 404));
    }

    // Find the attachment index
    const attachmentIndex = invoice.teamNotesAttachments.findIndex(
      (attachment) => attachment._id.toString() === attachmentId,
    );

    if (attachmentIndex === -1) {
      return next(new AppError('No attachment found with that ID', 404));
    }

    // Remove the attachment
    invoice.teamNotesAttachments.splice(attachmentIndex, 1);
    await invoice.save();

    res.status(200).json({
      status: 'success',
      data: {
        teamNotesAttachments: invoice.teamNotesAttachments,
      },
    });
  } catch (error) {
    next(error);
  }
});
