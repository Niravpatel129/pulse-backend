import FileItem from '../../models/FileManager.js';

export const getFiles = async (req, res) => {
  try {
    const { section, path = [] } = req.query;
    const workspaceId = req.workspace.id;

    // Validate section parameter
    if (!section) {
      return res.status(400).json({
        error: true,
        message: 'Section parameter is required (workspace or private)',
      });
    }

    console.log('Query params:', { section, path, workspaceId });

    // Build query
    const query = {
      workspaceId,
      section,
      status: 'active',
      path: [], // Directly match empty array for root items
    };

    console.log('MongoDB query:', JSON.stringify(query, null, 2));

    // Get files and folders
    const items = await FileItem.find(query).populate('children').sort({ type: 1, name: 1 }); // Folders first, then files, alphabetically

    console.log('Found items:', items.length);
    console.log(
      'First item if exists:',
      items[0] ? JSON.stringify(items[0].toObject(), null, 2) : 'No items found',
    );

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
