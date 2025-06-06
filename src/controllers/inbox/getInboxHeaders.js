import EmailThread from '../../models/Email/EmailThreadModel.js';
import catchAsync from '../../utils/catchAsync.js';

export const getInboxHeaders = catchAsync(async (req, res, next) => {
  const workspaceId = req.workspace._id;
  const stages = ['unassigned', 'assigned', 'archived', 'snoozed', 'trash', 'spam'];

  // Get latest thread for each stage
  const latestThreads = await Promise.all(
    stages.map(async (stage) => {
      const thread = await EmailThread.findOne({
        workspaceId,
        stage,
      }).sort({ createdAt: -1 });

      return {
        stage,
        threadId: thread?._id || null,
        isRead: thread?.isRead || false,
      };
    }),
  );

  // Convert array to object with stages as keys
  const result = latestThreads.reduce((acc, { stage, threadId, isRead }) => {
    acc[stage] = { threadId, isRead };
    return acc;
  }, {});

  res.status(200).json({
    status: 'success',
    data: result,
  });
});
