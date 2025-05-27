import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ['system', 'user', 'assistant', 'function'],
    },
    content: {
      type: String,
      required: true,
    },
    images: [
      {
        url: String,
        alt: String,
      },
    ],
    name: {
      type: String,
      // Only required for function role messages
    },
    function_call: {
      // For storing function calls
      name: String,
      arguments: String,
    },
    agent: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
      },
      name: String,
      icon: String,
    },
  },
  { _id: false },
);

const aiConversationSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    title: {
      type: String,
      default: 'New Conversation',
    },
    messages: [messageSchema],
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Index for more efficient queries
aiConversationSchema.index({ workspace: 1, createdAt: -1 });
aiConversationSchema.index({ lastActive: -1 });
aiConversationSchema.index({ 'messages.agent.id': 1 });

const AIConversation = mongoose.model('AIConversation', aiConversationSchema);

export default AIConversation;
