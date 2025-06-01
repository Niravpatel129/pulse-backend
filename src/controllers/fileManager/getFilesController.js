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
      path: path, // Use the provided path parameter
    };

    console.log('MongoDB query:', JSON.stringify(query, null, 2));

    // Get files and folders with populated children
    const items = await FileItem.find(query)
      .populate({
        path: 'children',
        match: { status: 'active' },
        options: { sort: { type: 1, name: 1 } }, // Sort children: folders first, then files alphabetically
      })
      .sort({ type: 1, name: 1 }); // Sort parent items: folders first, then files alphabetically

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
