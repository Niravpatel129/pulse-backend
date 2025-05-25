import File from '../../models/fileModel.js';
import Invoice2 from '../../models/invoice2.js';
import AppError from '../../utils/AppError.js';
import { firebaseStorage } from '../../utils/firebase.js';

export const deleteAttachment = async (req, res, next) => {
  const { id, fileId } = req.params;

  if (!id || !fileId) {
    return next(new AppError('Invoice ID and file ID are required', 400));
  }

  const invoice = await Invoice2.findById(id);
  if (!invoice) {
    return next(new AppError('Invoice not found', 404));
  }

  // Find the file record
  const file = await File.findById(fileId);
  if (!file) {
    return next(new AppError('File not found', 404));
  }

  try {
    // Delete file from Firebase storage if it has a storage path
    if (file.storagePath) {
      await firebaseStorage.deleteFile(file.storagePath);
    }

    // Delete the file record from the database
    await File.findByIdAndDelete(fileId);

    // Remove fileId from attachments array
    invoice.attachments = invoice.attachments.filter((attachmentId) => attachmentId !== fileId);
    await invoice.save();

    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    return next(new AppError('Failed to delete attachment', 500));
  }
};
