import FileItem from '../../models/FileManager.js';

export const getFiles = async (req, res) => {
  try {
    const { section, path } = req.query;
    const workspaceId = req.workspace.id;
    const isStructureRequest = req.originalUrl.includes('/structure');

    console.log('Query params:', { section, path, workspaceId, isStructureRequest });

    // Build query
    const query = {
      workspaceId,
      status: 'active',
    };

    // Add section to query if provided
    if (section) {
      query.section = section;
    }

    // Only apply path filtering if not a structure request
    if (!isStructureRequest && path) {
      try {
        // If path is a string representation of an array, parse it
        const parsedPath = JSON.parse(path);
        if (Array.isArray(parsedPath)) {
          query.path = parsedPath;
        } else {
          query.path = [path]; // If it's a single string, wrap it in an array
        }
      } catch (e) {
        // If parsing fails, treat it as a single path segment
        query.path = [path];
      }
    } else if (!isStructureRequest) {
      // For root level items, path should be an empty array (only for non-structure requests)
      query.path = [];
    }

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
