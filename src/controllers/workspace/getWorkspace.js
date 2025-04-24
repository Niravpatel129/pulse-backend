import mongoose from 'mongoose';
import Workspace from '../../models/Workspace.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getWorkspace = async (req, res, next) => {
  try {
    const workspace = req.workspace;
    const userId = req.user._id;

    // Validate if workspaceId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(workspace._id)) {
      throw new ApiError(400, 'Invalid workspace ID format');
    }

    const workspaceData = await Workspace.findOne({
      _id: workspace._id,
    }).populate('members.user', 'name email');

    if (!workspaceData) {
      throw new ApiError(404, 'Workspace not found');
    }

    return res.status(200).json(new ApiResponse(200, workspaceData));
  } catch (error) {
    next(error);
  }
};
