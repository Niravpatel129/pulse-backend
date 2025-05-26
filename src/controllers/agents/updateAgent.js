import Agent from '../../models/agentModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const updateAgent = catchAsync(async (req, res, next) => {
  const { name, description, icon, sections } = req.body;

  const agent = await Agent.findOneAndUpdate(
    {
      _id: req.params.id,
      workspace: req.workspace._id,
    },
    {
      name,
      description,
      icon,
      sections,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!agent) {
    return next(new AppError('No agent found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      agent,
    },
  });
});
