import Project from '../../models/Project.js';
import ApiResponse from '../../utils/apiResponse.js';

// Create project
export const createProject = async (req, res, next) => {
  try {
    const {
      name,
      type: projectType,
      leadSource,
      stage,
      description = '',
      status = 'planning',
    } = req.body;

    const userId = req.user._id;

    const projectData = {
      name,
      projectType,
      leadSource,
      stage,
      description,
      status,
      createdBy: userId,
    };

    const project = await Project.create(projectData);
    return res.status(201).json(new ApiResponse(201, project));
  } catch (error) {
    next(error);
  }
};
