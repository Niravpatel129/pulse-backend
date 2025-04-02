import File from '../../models/fileModel.js';

export const getFiles = async (req, res) => {
  try {
    const { moduleId } = req.query;
    const workspaceId = req.workspace.id;

    // Build query
    const query = {
      workspaceId,
      status: 'active',
    };

    // Add moduleId to query if provided
    if (moduleId) {
      query.moduleId = moduleId;
    }

    // Get files from database
    const files = await File.find(query)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      files,
    });
  } catch (error) {
    console.error('Error getting files:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Error retrieving files',
    });
  }
};
