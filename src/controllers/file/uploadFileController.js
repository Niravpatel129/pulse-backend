import File from '../../models/fileModel.js';
import { firebaseStorage } from '../../utils/firebase.js';

export const uploadFile = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: true,
        message: 'No files were uploaded',
      });
    }

    const uploadedFiles = await Promise.all(
      req.files.map(async (file) => {
        const storagePath = firebaseStorage.generatePath(req.workspace.id, file.originalname);

        const { url, storagePath: path } = await firebaseStorage.uploadFile(
          file.buffer,
          storagePath,
          file.mimetype,
        );

        // Create file record in database
        const fileRecord = await File.create({
          name: file.originalname,
          originalName: file.originalname,
          storagePath: path,
          downloadURL: url,
          contentType: file.mimetype,
          size: file.size,
          workspaceId: req.workspace.id,
          uploadedBy: req.user.id,
        });

        return {
          id: fileRecord._id,
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url,
          storagePath: path,
          createdAt: fileRecord.createdAt,
          updatedAt: fileRecord.updatedAt,
        };
      }),
    );

    res.status(200).json({
      success: true,
      message: 'Files uploaded successfully',
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Error uploading files',
    });
  }
};
