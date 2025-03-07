import FileElement from '../../models/Elements/FileElement.js';
import Module from '../../models/Module.js';
import { handleError } from '../../utils/errorHandler.js';
import { fileUtils, firebaseStorage } from '../../utils/firebase.js';

const createFileElement = async (req, res) => {
  try {
    const { moduleId } = req.params;

    // Check if module exists
    const module = await Module.findById(moduleId);
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    // Handle file uploads
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const uploadedFiles = await Promise.all(
      req.files.map(async (file) => {
        const storagePath = firebaseStorage.generatePath(
          req.workspace._id,
          moduleId,
          file.originalname,
        );

        const { url: firebaseUrl } = await firebaseStorage.uploadFile(
          file.buffer,
          storagePath,
          file.mimetype,
        );

        return fileUtils.createFileObject(file, firebaseUrl, storagePath);
      }),
    );

    // Create the file element with required fields
    const element = new FileElement({
      moduleId,
      addedBy: req.user.userId,
      files: uploadedFiles.map((file) => file.firebaseUrl),
      createdAt: new Date(),
    });

    await element.save();

    res.status(201).json({
      success: true,
      data: element,
    });
  } catch (error) {
    console.error('Error creating file element:', error);
    return handleError(res, error, 'Error creating file element');
  }
};

export default createFileElement;
