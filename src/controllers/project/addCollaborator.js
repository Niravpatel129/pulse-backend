import Project from '../../models/Project.js';
import User from '../../models/User.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const addCollaborator = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const collaborator = req.body;

    if (!projectId || !collaborator) {
      throw new ApiError(400, 'Project ID and collaborator details are required');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Check if workspace exists in request
    if (!req.workspace || !req.workspace._id) {
      throw new ApiError(400, 'Workspace not found in request');
    }

    // Initialize collaborators array if it doesn't exist
    if (!project.collaborators) {
      project.collaborators = [];
    }

    // If user ID is provided, check if user exists and is already a collaborator
    if (collaborator.user) {
      const user = await User.findById(collaborator.user);
      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Check if user is already a collaborator on this project
      const isAlreadyCollaborator = project.collaborators.some(
        (collab) => collab.user && collab.user.toString() === collaborator.user,
      );

      if (isAlreadyCollaborator) {
        throw new ApiError(400, 'User is already a collaborator on this project');
      }
    } else if (collaborator.email) {
      // Check if email is already a collaborator
      const isAlreadyCollaborator = project.collaborators.some(
        (collab) => collab.email === collaborator.email,
      );

      if (isAlreadyCollaborator) {
        throw new ApiError(400, 'This email is already a collaborator on this project');
      }
    }

    // Add collaborator with all provided details
    // The payload already contains all necessary fields:
    // id, name, role, initials, email, phone, mailingAddress, companyName,
    // companyType, companyWebsite, status, permissions, dateAdded
    project.collaborators.push(collaborator);
    await project.save();

    res.status(200).json(new ApiResponse(200, project, 'Collaborator added successfully'));
  } catch (error) {
    next(error);
  }
};
