import Workspace from '../../models/Workspace.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const updateWorkspace = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user._id;
    const { name, description, settings } = req.body;

    const workspace = await Workspace.findOne({
      _id: workspaceId,
      'members.user': userId,
      'members.role': { $in: ['owner', 'admin'] },
      isActive: true,
    });

    if (!workspace) {
      throw new ApiError(404, 'Workspace not found or insufficient permissions');
    }

    const updatedWorkspace = await Workspace.findByIdAndUpdate(
      workspaceId,
      {
        $set: {
          name,
          description,
          'settings.allowMemberInvites': settings?.allowMemberInvites,
          'settings.defaultProjectVisibility': settings?.defaultProjectVisibility,
        },
      },
      { new: true },
    ).populate('members.user', 'name email');

    return res.status(200).json(new ApiResponse(200, updatedWorkspace));
  } catch (error) {
    next(error);
  }
};
