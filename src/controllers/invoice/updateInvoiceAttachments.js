import Invoice from '../../models/invoiceModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const updateInvoiceAttachments = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const attachment = req.body;

    // Validate attachment object
    if (
      !attachment.fileId ||
      !attachment.name ||
      !attachment.url ||
      !attachment.type ||
      !attachment.size
    ) {
      return next(new AppError('Attachment must have fileId, name, url, type, and size', 400));
    }

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return next(new AppError('No invoice found with that ID', 404));
    }

    // Format the attachment to match schema
    const formattedAttachment = {
      id: attachment.fileId,
      name: attachment.name,
      url: attachment.url,
      type: attachment.type,
      size: attachment.size,
    };

    // Initialize teamNotesAttachments if it doesn't exist
    if (!invoice.teamNotesAttachments) {
      invoice.teamNotesAttachments = [];
    }

    // Add the new attachment
    invoice.teamNotesAttachments.push(formattedAttachment);
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
