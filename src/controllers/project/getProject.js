import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace._id;
    const userId = req.user._id;

    const project = await Project.findOne({
      _id: id,
      workspace: workspaceId,
      isActive: true,
      $or: [{ createdBy: userId }, { 'participants.user': userId }],
    })
      .populate('createdBy', 'name email')
      .populate('participants.user', 'name email');

    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    return res.status(200).json(new ApiResponse(200, project));
  } catch (error) {
    next(error);
  }
};
