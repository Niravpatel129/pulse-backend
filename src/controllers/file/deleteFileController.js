import File from '../../models/fileModel.js';
import { firebaseStorage } from '../../utils/firebase.js';

export const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const workspaceId = req.workspace.id;

    // Find the file in database
    const file = await File.findOne({
      _id: fileId,
      workspaceId,
      status: 'active',
    });

    if (!file) {
      return res.status(404).json({
        error: true,
        message: 'File not found',
      });
    }

    // Delete from Firebase Storage
    await firebaseStorage.deleteFile(file.storagePath);

    // Soft delete in database
    file.status = 'deleted';
    await file.save();

    res.status(200).json({
      success: true,
      message: 'File deleted successfully',
      fileId,
    });
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Error deleting file',
    });
  }
};
