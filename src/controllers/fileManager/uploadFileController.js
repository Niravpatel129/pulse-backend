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

    const { section, parentId } = req.body;
    const workspaceId = req.workspace.id;

    // If parentId is provided, verify it exists and belongs to the workspace
    let parent = null;
    if (parentId) {
      parent = await FileItem.findOne({
        _id: parentId,
        workspaceId,
        status: 'active',
      });

      if (!parent) {
        return res.status(400).json({
          error: true,
          message: 'Parent folder not found or you do not have access to it',
        });
      }
    }

    const uploadedFiles = await Promise.all(
      req.files.map(async (file) => {
        // Check if file already exists in the same parent
        const existingFile = await FileItem.findOne({
          name: file.originalname,
          type: 'file',
          parent: parentId || null,
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
          parent: parentId || null,
          workspaceId,
          createdBy: req.user.id,
          fileDetails,
        });

        // If there's a parent, add this file to its children array
        if (parent) {
          await FileItem.findByIdAndUpdate(parentId, {
            $push: { children: fileItem._id },
          });
        }

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
