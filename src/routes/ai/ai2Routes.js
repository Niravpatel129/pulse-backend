import express from 'express';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import { authenticate } from '../../middleware/auth.js';
import { extractWorkspace } from '../../middleware/workspace.js';

const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store conversation history in memory (in production, you'd want to use a database)
const conversationHistory = new Map();

// Set up rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later',
});

// Apply middleware
router.use(limiter);
router.use(authenticate);
router.use(extractWorkspace);

// Streaming chat endpoint
router.post('/chat/stream', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const workspaceId = req.workspace._id.toString();
    const userId = req.user.userId;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Create a unique session key
    const sessionKey = `${workspaceId}:${sessionId || userId}`;

    // Get existing conversation history or initialize new one
    let history = conversationHistory.get(sessionKey) || [];

    // Add user message to history
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      createdAt: new Date(),
    };
    history.push(userMessage);

    // Keep only last 10 messages to manage context window
    if (history.length > 10) {
      history = history.slice(-10);
    }

    // Set up streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Convert history to model messages format
    const modelMessages = history.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    let fullResponse = '';

    // Create the chat completion stream
    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant. Keep responses concise and relevant.',
        },
        ...modelMessages,
      ],
      temperature: 0.7,
      max_tokens: 500,
      stream: true,
      user: userId,
    });

    // Stream each chunk
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ type: 'text', content })}\n\n`);
      }
    }

    // Add AI response to history
    const aiMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: fullResponse,
      createdAt: new Date(),
    };
    history.push(aiMessage);

    // Update conversation history
    conversationHistory.set(sessionKey, history);

    // Send completion event
    res.write(`data: ${JSON.stringify({ type: 'end', sessionId: sessionId || userId })}\n\n`);
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
});

// Basic chat endpoint
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const workspaceId = req.workspace._id.toString();
    const userId = req.user.userId;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Create a unique session key
    const sessionKey = `${workspaceId}:${sessionId || userId}`;

    // Get existing conversation history or initialize new one
    let history = conversationHistory.get(sessionKey) || [];

    // Add user message to history
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      createdAt: new Date(),
    };
    history.push(userMessage);

    // Keep only last 10 messages to manage context window
    if (history.length > 10) {
      history = history.slice(-10);
    }

    // Convert history to model messages format
    const modelMessages = history.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Create the chat completion
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant. Keep responses concise and relevant.',
        },
        ...modelMessages,
      ],
      temperature: 0.7,
      max_tokens: 500,
      user: userId,
    });

    const fullResponse = completion.choices[0].message.content;

    // Add AI response to history
    const aiMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: fullResponse,
      createdAt: new Date(),
    };
    history.push(aiMessage);

    // Update conversation history
    conversationHistory.set(sessionKey, history);

    return res.json({
      response: fullResponse,
      sessionId: sessionId || userId,
    });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return res.status(500).json({
      error: error.message,
    });
  }
});

// Clear conversation history
router.delete('/chat/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const workspaceId = req.workspace._id.toString();
    const sessionKey = `${workspaceId}:${sessionId}`;

    conversationHistory.delete(sessionKey);

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
});

export default router;
