import PipelineSettings from '../../models/pipelineSettings.js';
import Project from '../../models/Project.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getProjects = async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;

    const projects = await Project.find({
      workspace: workspaceId,
    })
      .populate('createdBy', 'name email')
      .populate('manager', 'name email')
      .populate('clients', 'name email')
      .populate('participants.participant', 'name email');

    // Get pipeline settings for the workspace
    const pipelineSettings = await PipelineSettings.findOne({ workspace: workspaceId });

    // Map projects to include stage and status objects
    const projectsWithPipelineData = projects.map((project) => {
      const stageObj = pipelineSettings.stages.find((s) => s._id.toString() === project.stage);
      const statusObj = pipelineSettings.statuses.find((s) => s._id.toString() === project.status);

      return {
        ...project.toObject(),
        stage: stageObj || project.stage,
        status: statusObj || project.status,
      };
    });

    return res.status(200).json(new ApiResponse(200, projectsWithPipelineData));
  } catch (error) {
    next(error);
  }
};
