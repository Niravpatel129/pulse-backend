import FigmaFile from '../../../models/figmaFileModel.js';
import ApiResponse from '../../../utils/apiResponse.js';

export const getFigmaFiles = async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;

    // Get all Figma files for the workspace
    const figmaFiles = await FigmaFile.find({ workspaceId })
      .sort({ createdAt: -1 })
      .populate('addedBy', 'name email');

    // Return the files
    return res
      .status(200)
      .json(new ApiResponse(200, figmaFiles, 'Figma files retrieved successfully'));
  } catch (error) {
    next(error);
  }
};
