import Project from '../../models/Project.js';
import User from '../../models/User.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const addTeamMember = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { members } = req.body;

    if (!projectId || !members || !Array.isArray(members) || members.length === 0) {
      throw new ApiError(400, 'Project ID and members array are required');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    // Initialize team array if it doesn't exist
    if (!project.team) {
      project.team = [];
    }

    // Process each member in the array
    for (const member of members) {
      const { id } = member;

      // Check if user exists
      const user = await User.findById(id);
      if (!user) {
        throw new ApiError(404, `User with ID ${id} not found`);
      }
      console.log('🚀 user:', user);

      // Check if user is already in the team
      // Using toString() on ObjectId to ensure proper comparison
      const isAlreadyTeamMember = project.team.some(
        (teamMember) => teamMember.user && teamMember.user.toString() === id.toString(),
      );

      console.log('🚀 project.team:', project.team);

      if (isAlreadyTeamMember) {
        throw new ApiError(400, `User ${user.email} is already a team member on this project`);
      }

      // Add user to team
      project.team.push({
        user: id,
      });
    }

    await project.save();

    return res
      .status(200)
      .json(new ApiResponse(200, { project }, 'Team member(s) added successfully'));
  } catch (error) {
    next(error);
  }
};
