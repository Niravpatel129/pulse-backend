import FileItem from '../../models/FileManager.js';
import { fileUtils, firebaseStorage } from '../../utils/firebase.js';

export const uploadFile = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: true,
        message: 'No files were uploaded',
      });
    }

    const { section, path = [] } = req.body;
    const workspaceId = req.workspace.id;

    const uploadedFiles = await Promise.all(
      req.files.map(async (file) => {
        // Check if file already exists in the same path
        const existingFile = await FileItem.findOne({
          name: file.originalname,
          type: 'file',
          path,
          section,
          workspaceId,
          status: 'active',
        });

        if (existingFile) {
          throw new Error(`A file named "${file.originalname}" already exists in this location`);
        }

        // Upload to Firebase
        const storagePath = firebaseStorage.generatePath(workspaceId, file.originalname);
        const { url, storagePath: firebasePath } = await firebaseStorage.uploadFile(
          file.buffer,
          storagePath,
          file.mimetype,
        );

        // Create file record using fileUtils
        const fileDetails = fileUtils.createFileObject(file, url, firebasePath);
        const fileItem = await FileItem.create({
          name: file.originalname,
          type: 'file',
          size: fileDetails.size,
          section,
          path,
          workspaceId,
          createdBy: req.user.id,
          fileDetails,
        });

        return fileItem;
      }),
    );

    res.status(200).json({
      success: true,
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
