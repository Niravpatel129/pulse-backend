import FileItem from '../../models/FileManager.js';

export const getFiles = async (req, res) => {
  try {
    const { section, path } = req.query;
    const workspaceId = req.workspace.id;
    const workspaceShortid = req.workspace.shortid;
    const isStructureRequest = req.originalUrl.includes('/structure');

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
          if (parsedPath.length === 0) {
            // For root level items, path should be an empty array
            query.path = [];
          } else {
            // For nested items, match items that are direct children of this path
            query.path = { $size: parsedPath.length + 1, $all: parsedPath };
          }
        } else {
          // If it's a single string, match items that are direct children of this path
          query.path = { $size: 2, $all: [path] };
        }
      } catch (e) {
        // If parsing fails, treat it as a single path segment
        query.path = { $size: 2, $all: [path] };
      }
    } else if (!isStructureRequest) {
      // For root level items, path should be an empty array (only for non-structure requests)
      query.path = [];
    }

    console.log('Query being executed:', JSON.stringify(query, null, 2));

    // Get files and folders with populated children
    let items = await FileItem.find(query)
      .populate({
        path: 'children',
        match: { status: 'active' },
        options: { sort: { type: 1, name: 1 } }, // Sort children: folders first, then files alphabetically
      })
      .sort({ type: 1, name: 1 }); // Sort parent items: folders first, then files alphabetically

    console.log('Number of items found:', items.length);
    console.log(
      'First item if any:',
      items.length > 0 ? JSON.stringify(items[0].toObject(), null, 2) : 'No items found',
    );

    // Add workspaceShortid to each item and its children
    items = items.map((item) => {
      const itemObj = item.toObject();
      itemObj.workspaceShortid = workspaceShortid;
      if (itemObj.children) {
        itemObj.children = itemObj.children.map((child) => ({
          ...child,
          workspaceShortid,
        }));
      }
      return itemObj;
    });

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
