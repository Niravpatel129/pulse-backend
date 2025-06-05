import EmailThread from '../../models/Email/EmailThreadModel.js';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

export const moveToTrash = catchAsync(async (req, res, next) => {
  const { threadId } = req.params;

  const thread = await EmailThread.findOne({ threadId });

  if (!thread) {
    return next(new AppError('No email thread found with that ID', 404));
  }

  // Check if the thread belongs to the user's workspace
  if (thread.workspaceId.toString() !== req.workspace._id.toString()) {
    return next(new AppError('You do not have permission to update this thread', 403));
  }

  thread.stage = 'trash';
  await thread.save();

  res.status(200).json({
    success: true,
    data: thread,
  });
});
