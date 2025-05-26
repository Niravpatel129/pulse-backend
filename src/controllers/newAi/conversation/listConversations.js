import AIConversation from '../../../models/AIConversation.js';

export const listConversations = async (req, res) => {
  try {
    const workspaceId = req.workspace._id;

    const conversations = await AIConversation.find({ workspace: workspaceId })
      .select('title lastActive createdAt')
      .sort({ lastActive: -1 });

    return res.json({
      status: 'success',
      conversations,
    });
  } catch (error) {
    console.error('Error listing conversations:', error);
    return res.status(500).json({
      error: error.message,
    });
  }
};
