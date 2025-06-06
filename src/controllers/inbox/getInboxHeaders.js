import EmailThread from '../../models/Email/EmailThreadModel.js';
import catchAsync from '../../utils/catchAsync.js';

export const getInboxHeaders = catchAsync(async (req, res, next) => {
  const { workspaceId } = req.params;

  const stages = ['unassigned', 'assigned', 'archived', 'snoozed', 'trash', 'spam'];

  // Get all threads for the workspace
  const threads = await EmailThread.find({
    workspaceId,
    stage: { $in: stages },
  }).sort({ createdAt: -1 });

  // Group threads by stage and count unread threads
  const groupedThreads = stages.reduce((acc, stage) => {
    const stageThreads = threads.filter((thread) => thread.stage === stage);
    acc[stage] = {
      threads: stageThreads,
      unreadCount: stageThreads.filter((thread) => !thread.isRead).length,
    };
    return acc;
  }, {});

  res.status(200).json({
    status: 'success',
    data: groupedThreads,
  });
});
