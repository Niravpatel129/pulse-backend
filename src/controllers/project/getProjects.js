import Project from '../../models/Project.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getProjects = async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;

    const projects = await Project.find({
      workspace: workspaceId,
    })
      .populate('createdBy', 'name email')
      .populate('participants.participant', 'name email');

    return res.status(200).json(new ApiResponse(200, projects));
  } catch (error) {
    next(error);
  }
};
