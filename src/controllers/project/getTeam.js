import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getTeam = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      throw new ApiError(400, 'Project ID is required');
    }

    const project = await Project.findById(projectId)
      .populate('team.user', 'name email')
      .populate('manager', 'name email');

    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Format team data
    const team = (project.team || []).map((member) => ({
      id: member.user._id,
      name: member.user.name,
      email: member.user.email,
      type: 'team_member',
    }));

    return res.status(200).json(new ApiResponse(200, team, 'Team retrieved successfully'));
  } catch (error) {
    next(error);
  }
};
