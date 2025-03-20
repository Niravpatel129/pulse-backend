import Activity from '../../../models/Activity.js';
import ApiError from '../../../utils/apiError.js';

/**
 * Utility function to set up initial activities for a newly created project
 * This function should be called after a project is successfully created
 */
export const setupProjectActivities = async (project, userId, workspaceId) => {
  try {
    console.log('🔍 setupProjectActivities: Starting execution');

    if (!project || !project._id) {
      console.log('⚠️ No valid project provided, skipping activity creation');
      return;
    }

    console.log(
      '🔍 Project:',
      project ? { id: project._id, name: project.name } : 'No project found',
    );
    console.log('🔍 User ID:', userId);
    console.log('🔍 Workspace ID:', workspaceId);

    // Create project creation activity
    console.log('🔍 Creating project creation activity');
    const creationActivity = await Activity.create({
      user: userId,
      workspace: workspaceId,
      type: 'project',
      action: 'created',
      description: `Project "${project.name}" was created`,
      entityId: project._id,
      entityType: 'Project',
      project: project._id,
      metadata: {
        projectType: project.projectType,
        stage: project.stage,
        status: project.status,
      },
    });
    console.log('✅ Project creation activity created:', creationActivity._id);

    // Create project manager assignment activity if manager exists
    if (project.manager) {
      console.log('🔍 Creating project manager assignment activity');
      const assignmentActivity = await Activity.create({
        user: userId,
        workspace: workspaceId,
        type: 'project',
        action: 'assigned',
        description: `Project manager was assigned to "${project.name}"`,
        entityId: project._id,
        entityType: 'Project',
        project: project._id,
        metadata: {
          managerId: project.manager,
        },
      });
      console.log('✅ Project manager assignment activity created:', assignmentActivity._id);
    } else {
      console.log('ℹ️ No project manager assigned, skipping assignment activity');
    }

    console.log('🔍 setupProjectActivities: Execution completed successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error in setupProjectActivities:', error);
    console.error('❌ Error stack:', error.stack);
    throw new ApiError(500, 'Error setting up project activities');
  }
};
