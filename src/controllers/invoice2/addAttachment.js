import Invoice2 from '../../models/invoice2.js';
import AppError from '../../utils/AppError.js';

export const addAttachment = async (req, res, next) => {
  const { id } = req.params;
  const { fileId } = req.body;

  if (!fileId) {
    return next(new AppError('File ID is required', 400));
  }

  const invoice = await Invoice2.findById(id);
  if (!invoice) {
    return next(new AppError('Invoice not found', 404));
  }

  // Add fileId to attachments array if it doesn't exist
  if (!invoice.attachments.includes(fileId)) {
    invoice.attachments.push(fileId);
    await invoice.save();
  }

  res.status(200).json({
    success: true,
    data: invoice,
  });
};
