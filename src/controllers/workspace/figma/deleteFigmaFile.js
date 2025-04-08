import FigmaFile from '../../../models/figmaFileModel.js';
import ApiError from '../../../utils/apiError.js';
import ApiResponse from '../../../utils/apiResponse.js';

export const deleteFigmaFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { workspaceId } = req;
    const userId = req.user._id;

    // Find the Figma file
    const figmaFile = await FigmaFile.findOne({
      _id: id,
      workspaceId,
    });

    if (!figmaFile) {
      throw new ApiError(404, 'Figma file not found');
    }

    // Check if the user is the one who added the file or has admin permissions
    // This could be expanded with more sophisticated permission checks
    if (figmaFile.addedBy._id.toString() !== userId.toString()) {
      throw new ApiError(403, 'You do not have permission to delete this file');
    }

    // Delete the file
    await FigmaFile.findByIdAndDelete(id);

    return res.status(200).json(new ApiResponse(200, null, 'Figma file deleted successfully'));
  } catch (error) {
    next(error);
  }
};
