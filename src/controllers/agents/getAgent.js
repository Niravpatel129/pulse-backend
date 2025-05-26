import Agent from '../../models/agentModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const getAgent = catchAsync(async (req, res, next) => {
  const agent = await Agent.findOne({
    _id: req.params.id,
    workspace: req.workspace._id,
  });

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
