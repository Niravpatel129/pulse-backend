import FileElement from '../../models/Elements/FileElement.js';
import { handleError } from '../../utils/errorHandler.js';
import { firebaseStorage } from '../../utils/firebase.js';

/**
 * Delete a file element and its associated files from storage
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with success message or error
 */
const deleteFileElement = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the file element
    const element = await FileElement.findById(id);
    if (!element) {
      return res.status(404).json({
        success: false,
        message: 'File element not found',
      });
    }

    // Delete files from Firebase storage
    if (element.files && element.files.length > 0) {
      await Promise.all(
        element.files.map(async (file) => {
          if (file.storagePath) {
            await firebaseStorage.deleteFile(file.storagePath);
          }
        }),
      );
    }

    // Delete the file element from database
    await element.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'File element deleted successfully',
    });
  } catch (error) {
    return handleError(res, error, 'Error deleting file element');
  }
};

export default deleteFileElement;
