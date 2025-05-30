import mongoose from 'mongoose';

const MessagePartSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['text', 'reasoning', 'action', 'tool_call', 'tool_response', 'status'],
      required: true,
    },
    content: { type: String, required: true },
    step: String,
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const MessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ['system', 'user', 'assistant', 'function'],
    },
    parts: [MessagePartSchema],
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
    timestamp: { type: Date, default: Date.now },
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
    messages: [MessageSchema],
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
