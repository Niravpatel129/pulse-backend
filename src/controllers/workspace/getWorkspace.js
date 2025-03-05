import Workspace from '../../models/Workspace.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getWorkspace = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user._id;

    const workspace = await Workspace.findOne({
      _id: workspaceId,
      'members.user': userId,
      isActive: true,
    }).populate('members.user', 'name email');

    if (!workspace) {
      throw new ApiError(404, 'Workspace not found');
    }

    return res.status(200).json(new ApiResponse(200, workspace));
  } catch (error) {
    next(error);
  }
};
