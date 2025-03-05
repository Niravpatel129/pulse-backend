import Workspace from '../../models/Workspace.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getWorkspaces = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const workspaces = await Workspace.find({
      'members.user': userId,
      isActive: true,
    }).populate('members.user', 'name email');

    return res.status(200).json(new ApiResponse(200, workspaces));
  } catch (error) {
    next(error);
  }
};
