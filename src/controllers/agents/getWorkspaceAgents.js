import Agent from '../../models/agentModel.js';
import catchAsync from '../../utils/catchAsync.js';

export const getWorkspaceAgents = catchAsync(async (req, res, next) => {
  const agents = await Agent.find({ workspace: req.workspace._id }).sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: agents.length,
    data: {
      agents,
    },
  });
});
