import AIConversation from '../../../models/AIConversation.js';

export const clearChatHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const workspaceId = req.workspace._id;

    await AIConversation.findOneAndDelete({
      _id: sessionId,
      workspace: workspaceId,
    });

    return res.json({
      status: 'success',
      message: 'Conversation history cleared',
    });
  } catch (error) {
    console.error('Error clearing conversation history:', error);
    return res.status(500).json({
      error: error.message,
    });
  }
};
