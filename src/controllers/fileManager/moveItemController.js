import FileItem from '../../models/FileManager.js';

export const moveItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { newPath } = req.body;
    const workspaceId = req.workspace.id;

    // Find the item
    const item = await FileItem.findOne({
      _id: itemId,
      workspaceId,
      status: 'active',
    });

    if (!item) {
      return res.status(404).json({
        error: true,
        message: 'Item not found',
      });
    }

    // Check if an item with the same name exists in the target path
    const existingItem = await FileItem.findOne({
      name: item.name,
      path: newPath,
      section: item.section,
      workspaceId,
      status: 'active',
    });

    if (existingItem) {
      return res.status(400).json({
        error: true,
        message: 'An item with this name already exists in the target location',
      });
    }

    // Update the item's path
    const oldPath = item.path;
    item.path = newPath;
    await item.save();

    // If it's a folder, update all children's paths
    if (item.type === 'folder') {
      const children = await FileItem.find({
        path: { $regex: `^${oldPath.join('/')}/${item.name}` },
        workspaceId,
        status: 'active',
      });

      for (const child of children) {
        // Replace the old path prefix with the new path
        const newChildPath = child.path.map((p, index) => {
          if (index < oldPath.length) {
            return newPath[index];
          }
          return p;
        });

        child.path = newChildPath;
        await child.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Item moved successfully',
      data: item,
    });
  } catch (error) {
    console.error('Error moving item:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Error moving item',
    });
  }
};
