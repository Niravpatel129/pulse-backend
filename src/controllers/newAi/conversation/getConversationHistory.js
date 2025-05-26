import mongoose from 'mongoose';
import AIConversation from '../../../models/AIConversation.js';

export const getConversationHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const workspaceId = req.workspace._id;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const conversation = await AIConversation.findOne({
      _id: sessionId,
      workspace: workspaceId,
    }).select('title messages lastActive createdAt');

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    return res.json({
      status: 'success',
      conversation,
    });
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return res.status(500).json({
      error: error.message,
    });
  }
};
