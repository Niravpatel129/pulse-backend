import Agent from '../../models/agentModel.js';
import catchAsync from '../../utils/catchAsync.js';

export const createAgent = catchAsync(async (req, res, next) => {
  const { name, description, icon, sections } = req.body;

  const agent = await Agent.create({
    name,
    description,
    icon,
    sections,
    workspace: req.workspace._id,
    createdBy: req.user.userId,
  });

  res.status(201).json({
    status: 'success',
    data: {
      agent,
    },
  });
});
