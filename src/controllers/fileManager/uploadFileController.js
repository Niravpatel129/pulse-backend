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
    const workspaceShortid = req.workspace.shortid;

    // If parentId is provided, verify it exists and belongs to the workspace
    let parent = null;
    let parentPath = [];
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

      // Get the parent's path and add the parent's name to it
      parentPath = [...(parent.path || []), parent.name];
    }

    const uploadedFiles = await Promise.all(
      req.files.map(async (file) => {
        // Function to generate a unique filename
        const generateUniqueFilename = async (originalName, path, section, workspaceId) => {
          let counter = 1;
          let newName = originalName;
          const nameParts = originalName.split('.');
          const extension = nameParts.pop();
          const baseName = nameParts.join('.');

          while (true) {
            const existingFile = await FileItem.findOne({
              name: newName,
              type: 'file',
              path: path,
              section,
              workspaceId,
              status: 'active',
            });

            if (!existingFile) {
              return newName;
            }

            newName = `${baseName} (${counter}).${extension}`;
            counter++;
          }
        };

        // Generate unique filename
        const uniqueFilename = await generateUniqueFilename(
          file.originalname,
          parentPath,
          section,
          workspaceId,
        );

        // Update the file object with the unique name
        file.originalname = uniqueFilename;

        // Upload to Firebase
        const storagePath = firebaseStorage.generatePath(workspaceId, uniqueFilename);
        const { url, storagePath: firebasePath } = await firebaseStorage.uploadFile(
          file.buffer,
          storagePath,
          file.mimetype,
        );

        // Create file record using fileUtils
        const fileDetails = fileUtils.createFileObject(file, url, firebasePath);
        const fileItem = await FileItem.create({
          name: uniqueFilename,
          type: 'file',
          size: file.size.toString(),
          section,
          path: parentPath,
          workspaceId,
          workspaceShortid,
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
