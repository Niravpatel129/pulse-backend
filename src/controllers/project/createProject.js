import Project from '../../models/Project.js';
import ApiResponse from '../../utils/apiResponse.js';
import { setupProjectActivities } from './middleware/projectSetup.js';

// Create project
export const createProject = async (req, res, next) => {
  try {
    const {
      name,
      stage,
      status,
      manager,
      description,
      client,
      startDate,
      targetDate,
      attachments = [],
    } = req.body;

    const userId = req.user.userId;
    const workspaceId = req.workspace._id;

    const projectData = {
      name,
      stage,
      status,
      manager,
      description,
      clients: client,
      startDate,
      targetDate,
      attachments,
      workspace: workspaceId,
      createdBy: userId,
    };

    const project = await Project.create(projectData);
    await setupProjectActivities(project, userId, workspaceId);

    return res.status(201).json(new ApiResponse(201, project));
  } catch (error) {
    next(error);
  }
};
