import mongoose from 'mongoose';
import OpenAI from 'openai';
import AIConversation from '../../models/AIConversation.js';
import ChatSettings from '../../models/ChatSettings.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const countTokens = (messages) => {
  return messages.reduce((count, msg) => count + Math.ceil(msg.content.length / 4), 0);
};

// Utility function to summarize messages
const summarizeMessages = async (messages) => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'Summarize the following conversation in a concise way that preserves key information and context.',
        },
        ...messages,
      ],
      temperature: 0.3,
      max_tokens: 150,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error summarizing messages:', error);
    return 'Previous conversation context';
  }
};

const MAX_CONTEXT_TOKENS = 4000;

export const streamChat = async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    console.log('🚀 sessionId:', sessionId);
    const workspaceId = req.workspace._id;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get workspace chat settings
    const chatSettings = await ChatSettings.findOne({ workspace: workspaceId });
    const systemMessage =
      chatSettings?.contextSettings ||
      'You are a helpful AI assistant. Keep responses concise and relevant.';

    // Get or create conversation
    let conversation;
    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
      console.log('🚀 sessionId11:', sessionId);
      conversation = await AIConversation.findOne({
        _id: sessionId,
        workspace: workspaceId,
      });
    }

    if (!conversation) {
      // Create new conversation with a new MongoDB ObjectId
      conversation = await AIConversation.create({
        workspace: workspaceId,
        messages: [],
        title: 'New Conversation', // You can update this later based on the first message
      });
    }

    // Add user message
    const userMessage = {
      role: 'user',
      content: message,
    };
    conversation.messages.push(userMessage);

    // Check token count and manage context window
    let messagesToSend = [...conversation.messages];
    let totalTokens = countTokens(messagesToSend);
    console.log('🚀 conversation:', conversation);

    // If we exceed the token limit, summarize older messages
    if (totalTokens > MAX_CONTEXT_TOKENS) {
      const messagesToSummarize = messagesToSend.slice(0, -10);
      const summary = await summarizeMessages(messagesToSummarize);

      // Replace older messages with summary
      messagesToSend = [{ role: 'system', content: summary }, ...messagesToSend.slice(-10)];
    }

    // Set up streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    let fullResponse = '';

    // Create the chat completion stream
    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: systemMessage,
        },
        ...messagesToSend,
      ],
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
    });

    // Stream each chunk
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ type: 'text', content })}\n\n`);
      }
    }

    // Add AI response to conversation
    const aiMessage = {
      role: 'assistant',
      content: fullResponse,
    };
    conversation.messages.push(aiMessage);
    conversation.lastActive = new Date();

    // Save the updated conversation
    await conversation.save();

    // Send completion event with the conversation ID
    res.write(
      `data: ${JSON.stringify({
        type: 'end',
        sessionId: conversation._id,
        isNewConversation: !sessionId,
      })}\n\n`,
    );
    res.end();
  } catch (error) {
    console.error('Error in streaming chat endpoint:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: error.message,
      });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
};

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
