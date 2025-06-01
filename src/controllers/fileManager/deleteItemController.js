import FileItem from '../../models/FileManager.js';
import { firebaseStorage } from '../../utils/firebase.js';

export const deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;
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

    // If it's a file, delete from Firebase
    if (item.type === 'file' && item.fileDetails?.storagePath) {
      await firebaseStorage.deleteFile(item.fileDetails.storagePath);
    }

    // If it's a folder, recursively delete all children
    if (item.type === 'folder') {
      const children = await FileItem.find({
        path: { $regex: `^${item.path.join('/')}/${item.name}` },
        workspaceId,
        status: 'active',
      });

      // Delete files from Firebase
      for (const child of children) {
        if (child.type === 'file' && child.fileDetails?.storagePath) {
          await firebaseStorage.deleteFile(child.fileDetails.storagePath);
        }
      }

      // Mark all children as deleted
      await FileItem.updateMany(
        {
          _id: { $in: children.map((c) => c._id) },
        },
        { status: 'deleted' },
      );
    }

    // Mark the item as deleted
    item.status = 'deleted';
    await item.save();

    res.status(200).json({
      success: true,
      message: 'Item deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Error deleting item',
    });
  }
};
