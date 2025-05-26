import mongoose from 'mongoose';
import openai from '../../../config/openai.js';
import AIConversation from '../../../models/AIConversation.js';
import ChatSettings from '../../../models/ChatSettings.js';
import { countTokens, MAX_CONTEXT_TOKENS, summarizeMessages } from '../../../utils/aiUtils.js';

export const streamChat = async (req, res) => {
  try {
    const {
      message,
      sessionId,
      model = 'gpt-4o',
      temperature = 0.7,
      max_tokens = 8000,
      top_p = 1,
      frequency_penalty = 0,
      presence_penalty = 0,
      stop = null,
    } = req.body;

    const workspaceId = req.workspace._id;

    if (!message) {
      return res.status(400).json({
        error: {
          message: 'Message is required',
          type: 'invalid_request_error',
          code: 'missing_message',
        },
      });
    }

    // Get workspace chat settings
    const chatSettings = await ChatSettings.findOne({ workspace: workspaceId });
    const systemMessage = {
      role: 'system',
      content:
        chatSettings?.contextSettings ||
        'You are a helpful AI assistant. Keep responses concise and relevant.',
    };

    // Get or create conversation
    let conversation;
    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
      conversation = await AIConversation.findOne({
        _id: sessionId,
        workspace: workspaceId,
      });
    }

    if (!conversation) {
      let title = message.trim();
      if (title.endsWith('?')) {
        title = title.substring(0, 50);
      } else {
        const words = title.split(' ');
        if (words.length > 5) {
          title = words.slice(0, 5).join(' ') + '...';
        }
      }

      conversation = await AIConversation.create({
        workspace: workspaceId,
        messages: [],
        title: title,
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

    if (totalTokens > MAX_CONTEXT_TOKENS) {
      const messagesToSummarize = messagesToSend.slice(0, -10);
      const summary = await summarizeMessages(messagesToSummarize);
      messagesToSend = [{ role: 'system', content: summary }, ...messagesToSend.slice(-10)];
    }

    // Set up streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    let fullResponse = '';
    let finishReason = null;

    // Create the chat completion stream
    const stream = await openai.chat.completions.create({
      model,
      messages: [systemMessage, ...messagesToSend],
      temperature,
      max_tokens,
      top_p,
      frequency_penalty,
      presence_penalty,
      stop,
      stream: true,
    });

    // Stream each chunk
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      finishReason = chunk.choices[0]?.finish_reason;

      if (content) {
        fullResponse += content;
        res.write(
          `data: ${JSON.stringify({
            id: chunk.id,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: chunk.model,
            choices: [
              {
                index: 0,
                delta: { content },
                finish_reason: null,
              },
            ],
          })}\n\n`,
        );
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

    // Send completion event
    res.write(
      `data: ${JSON.stringify({
        id: conversation._id,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: aiMessage,
            finish_reason: finishReason,
          },
        ],
        usage: {
          prompt_tokens: totalTokens,
          completion_tokens: Math.ceil(fullResponse.length / 4),
          total_tokens: totalTokens + Math.ceil(fullResponse.length / 4),
        },
      })}\n\n`,
    );
    res.end();
  } catch (error) {
    console.error('Error in streaming chat endpoint:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: {
          message: error.message,
          type: 'server_error',
          code: 'internal_error',
        },
      });
    } else {
      res.write(
        `data: ${JSON.stringify({
          error: {
            message: error.message,
            type: 'server_error',
            code: 'internal_error',
          },
        })}\n\n`,
      );
      res.end();
    }
  }
};
