import EmailThread from '../../models/Email/EmailThreadModel.js';
import catchAsync from '../../utils/catchAsync.js';

export const getInboxHeaders = catchAsync(async (req, res, next) => {
  const workspaceId = req.workspace._id;
  const stages = ['unassigned', 'assigned', 'archived', 'snoozed', 'trash', 'spam'];

  // Get latest thread and check for unread threads for each stage
  const latestThreads = await Promise.all(
    stages.map(async (stage) => {
      // First check if any thread exists in this stage
      const hasThreads = await EmailThread.exists({ workspaceId, stage });

      if (!hasThreads) {
        return {
          stage,
          threadId: null,
          isRead: false,
        };
      }

      // Check if there are any unread threads in this stage
      const hasUnreadThreads = await EmailThread.exists({
        workspaceId,
        stage,
        isRead: false,
      });

      // Get the latest thread
      const thread = await EmailThread.findOne({
        workspaceId,
        stage,
      }).sort({ createdAt: -1 });

      return {
        stage,
        threadId: thread.threadId,
        isRead: !hasUnreadThreads, // If there are any unread threads, mark as unread
      };
    }),
  );

  // Convert array to object with stages as keys, excluding null threadIds
  const result = latestThreads.reduce((acc, { stage, threadId, isRead }) => {
    if (threadId !== null) {
      acc[stage] = {
        threadId,
        isRead: stage === 'spam' ? true : isRead,
      };
    }
    return acc;
  }, {});

  res.status(200).json({
    status: 'success',
    data: result,
  });
});
