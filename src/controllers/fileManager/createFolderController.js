import FileItem from '../../models/FileManager.js';

export const createFolder = async (req, res) => {
  try {
    const { name, section, path } = req.body;
    const workspaceId = req.workspace.id;

    // For root level folders, ensure path is an empty array
    const folderPath = path && path.length > 0 ? path : [];

    // Check if folder already exists in the same path
    const existingFolder = await FileItem.findOne({
      name,
      type: 'folder',
      path: folderPath,
      section,
      workspaceId,
      status: 'active',
    });

    if (existingFolder) {
      return res.status(400).json({
        error: true,
        message: 'A folder with this name already exists in this location',
      });
    }

    // Create new folder
    const folder = await FileItem.create({
      name,
      type: 'folder',
      section,
      path: folderPath,
      workspaceId,
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      folder,
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Error creating folder',
    });
  }
};
