import FileItem from '../../models/FileManager.js';

export const getFiles = async (req, res) => {
  try {
    const { parentId, section } = req.query;
    const workspaceId = req.workspace.id;

    // Build query
    const query = {
      workspaceId,
      status: 'active',
    };

    // Add section to query if provided
    if (section) {
      query.section = section;
    }

    // Add parentId to query if provided, otherwise get root level items
    if (parentId) {
      query.parent = parentId;
    } else {
      query.parent = null; // Get root level items
    }

    // Get files and folders from database
    const items = await FileItem.find(query)
      .populate('createdBy', 'name email')
      .populate('children')
      .sort({ type: 1, name: 1 }); // Sort folders first, then files alphabetically

    res.status(200).json({
      success: true,
      items,
    });
  } catch (error) {
    console.error('Error getting files:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Error retrieving files',
    });
  }
};
