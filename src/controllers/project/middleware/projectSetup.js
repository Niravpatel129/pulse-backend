import Activity from '../../../models/Activity.js';
import ApiError from '../../../utils/apiError.js';

/**
 * Middleware to set up initial activities for a newly created project
 * This middleware should be used after a project is successfully created
 */
export const setupProjectActivities = async (req, res, next) => {
  try {
    // Check if project exists in response
    const project = res.locals.project || (res.statusCode === 201 && res.locals.data);

    if (!project || !project._id) {
      return next();
    }

    const userId = req.user._id || req.user.userId;
    const workspaceId = req.workspace._id;

    // Create project creation activity
    await Activity.create({
      user: userId,
      workspace: workspaceId,
      type: 'project',
      action: 'create',
      description: `Project "${project.name}" was created`,
      entityId: project._id,
      entityType: 'Project',
      metadata: {
        projectType: project.projectType,
        stage: project.stage,
        status: project.status,
      },
    });

    // Create project manager assignment activity if manager exists
    if (project.manager) {
      await Activity.create({
        user: userId,
        workspace: workspaceId,
        type: 'project',
        action: 'assign',
        description: `Project manager was assigned to "${project.name}"`,
        entityId: project._id,
        entityType: 'Project',
        metadata: {
          managerId: project.manager,
        },
      });
    }

    return next();
  } catch (error) {
    return next(new ApiError(500, 'Error setting up project activities'));
  }
};
