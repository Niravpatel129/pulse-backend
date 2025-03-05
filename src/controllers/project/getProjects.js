import Project from '../../models/Project.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getProjects = async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;
    const userId = req.user._id;

    const projects = await Project.find({
      workspace: workspaceId,
      isActive: true,
      $or: [{ createdBy: userId }, { 'participants.user': userId }],
    })
      .populate('createdBy', 'name email')
      .populate('participants.user', 'name email');

    return res.status(200).json(new ApiResponse(200, projects));
  } catch (error) {
    next(error);
  }
};
