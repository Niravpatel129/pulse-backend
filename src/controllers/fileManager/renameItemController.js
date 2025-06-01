import FileItem from '../../models/FileManager.js';

export const renameItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { newName } = req.body;
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

    // Check if an item with the same name already exists in the same path
    const existingItem = await FileItem.findOne({
      name: newName,
      path: item.path,
      section: item.section,
      workspaceId,
      status: 'active',
      _id: { $ne: itemId }, // Exclude the current item
    });

    if (existingItem) {
      return res.status(400).json({
        error: true,
        message: 'An item with this name already exists in this location',
      });
    }

    // Update the item's name
    const oldName = item.name;
    item.name = newName;
    await item.save();

    // If it's a folder, update all children's paths
    if (item.type === 'folder') {
      const children = await FileItem.find({
        path: { $regex: `^${item.path.join('/')}/${oldName}` },
        workspaceId,
        status: 'active',
      });

      for (const child of children) {
        // Replace the old folder name with the new one in the path
        const newChildPath = child.path.map((p, index) => {
          if (index === item.path.length && p === oldName) {
            return newName;
          }
          return p;
        });

        child.path = newChildPath;
        await child.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Item renamed successfully',
      data: item,
    });
  } catch (error) {
    console.error('Error renaming item:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Error renaming item',
    });
  }
};
