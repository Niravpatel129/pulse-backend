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

    // Get files and folders with populated children
    let items = await FileItem.find(query)
      .populate({
        path: 'children',
        match: { status: 'active' },
        options: { sort: { type: 1, name: 1 } }, // Sort children: folders first, then files alphabetically
      })
      .sort({ type: 1, name: 1 }); // Sort parent items: folders first, then files alphabetically

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
