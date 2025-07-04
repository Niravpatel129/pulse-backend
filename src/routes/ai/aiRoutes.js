import { Queue, Worker } from 'bullmq';
import chalk from 'chalk';
import express from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import multer from 'multer';
import NodeCache from 'node-cache';
import Redis from 'redis';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../../middleware/auth.js';
import { extractWorkspace } from '../../middleware/workspace.js';
import AIConversation from '../../models/AIConversation.js';
import { firebaseStorage } from '../../utils/firebase.js';
import { registerShutdownHandler } from '../../utils/shutdownHandler.js';
import { clearRetrieverCache, clearUserCache, createQAChain } from './chain.js';
import documentRoutes from './documentRoutes.js';
import { processSmartResponse } from './smartResponse.js';
import testEmailContextRoutes from './testEmailContext.js';
import { closeVectorStore, initVectorStore } from './vectorStore.js';

const router = express.Router();

// Register document routes
router.use('/documents', documentRoutes);

// Register test email context routes
router.use('/test', testEmailContextRoutes);

// Store chains by workspace ID instead of a single global chain
const qaChains = new Map();

// Export qaChains so it can be accessed by other modules
export { qaChains };

// Create caches with TTL
const vectorStoreCache = new NodeCache({ stdTTL: 3600 }); // 1 hour

// Variables for message queue
let aiQueue;
let worker;
let redisClient;
let isRedisAvailable = false;

// Configure multer for image uploads
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'), false);
    }
  },
});

// Cost estimation function
function estimateQueryCost(query, response) {
  // Base cost calculations (adjust based on your actual model and pricing)
  const inputTokenEstimate = query.length / 4; // Rough estimate: 4 chars per token
  const outputTokenEstimate = response.length / 4;

  // Example pricing (adjust to your model's actual rates)
  const inputCostPerToken = 0.00001; // $0.01 per 1000 tokens
  const outputCostPerToken = 0.00002; // $0.02 per 1000 tokens

  const inputCost = inputTokenEstimate * inputCostPerToken;
  const outputCost = outputTokenEstimate * outputCostPerToken;
  const totalCost = inputCost + outputCost;

  return {
    inputTokens: Math.round(inputTokenEstimate),
    outputTokens: Math.round(outputTokenEstimate),
    totalCost,
  };
}

// Setup Redis client for BullMQ (optional)
(async () => {
  try {
    // Check if Heroku Redis URL is available
    const redisUrl =
      process.env.REDIS_URL || process.env.REDISCLOUD_URL || process.env.REDIS_TLS_URL;

    if (!redisUrl) {
      isRedisAvailable = false;
      return;
    }

    // Connect to Heroku Redis
    redisClient = Redis.createClient({
      url: redisUrl,
      socket: {
        tls: process.env.REDIS_TLS_URL ? true : false,
        rejectUnauthorized: false,
      },
    });

    // Try to connect to Redis
    await redisClient.connect();
    console.log('Redis connected successfully');
    isRedisAvailable = true;

    // Create a queue for processing AI requests
    aiQueue = new Queue('ai-processing', {
      connection: redisClient,
    });

    // Worker for processing queue jobs
    worker = new Worker(
      'ai-processing',
      async (job) => {
        try {
          const { message, jobId, sessionId, workspaceId, history, userId } = job.data;

          // Initialize QA chain if not already done for this workspace
          if (!qaChains.has(workspaceId)) {
            // Check if vector store is cached
            let vs;
            if (vectorStoreCache.get(`vectorStore:${workspaceId}`)) {
              vs = vectorStoreCache.get(`vectorStore:${workspaceId}`);
            } else {
              vs = await initVectorStore(workspaceId);
              // Cache the vector store
              vectorStoreCache.set(`vectorStore:${workspaceId}`, vs);
            }

            console.log('Creating QA chain...');
            const workspaceChain = await createQAChain(vs, workspaceId);
            // Store chain by workspace ID
            qaChains.set(workspaceId, workspaceChain);
          }

          // Get the chain for this workspace
          const workspaceChain = qaChains.get(workspaceId);

          // Process query with conversation context
          const startTime = Date.now();
          const result = await workspaceChain.invoke({
            query: message,
            messages: history,
            workspaceId,
            userId,
          });
          const endTime = Date.now();

          // Extract and prepare answer
          const answer = extractAnswer(result);

          // Update conversation in MongoDB
          const conversation = await AIConversation.findOne({
            _id: sessionId,
            workspace: workspaceId,
          });

          if (conversation) {
            const aiMessage = {
              role: 'assistant',
              content: answer,
            };
            conversation.messages.push(aiMessage);
            conversation.lastActive = new Date();
            await conversation.save();
          }

          // Estimate cost
          const costEstimate = estimateQueryCost(message, answer);
          console.log(
            chalk.green(`💰 AI Query Cost Estimate: $${costEstimate.totalCost.toFixed(6)}`) +
              chalk.yellow(
                ` (Input: ~${costEstimate.inputTokens} tokens, Output: ~${
                  costEstimate.outputTokens
                } tokens, Time: ${(endTime - startTime) / 1000}s)`,
              ),
          );

          // Return the answer
          return { answer, sessionId };
        } catch (err) {
          console.error('Error in worker:', err);
          throw err;
        }
      },
      { connection: redisClient },
    );

    // Handle worker errors
    worker.on('error', (err) => {
      console.error('Worker error:', err);
    });

    // Log completed jobs
    worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    // Add handler for refresh job
    worker.on('active', async (job) => {
      if (job.name === 'refresh-vector-store') {
        console.log(`Starting vector store refresh job ${job.id}`);
        try {
          const { workspaceId } = job.data;

          if (!workspaceId) {
            throw new Error('No workspace ID provided for refresh job');
          }

          console.log(`Refreshing vector store for workspace: ${workspaceId}`);

          // Close existing vector store connections for this workspace
          await closeVectorStore(workspaceId);

          // Clear caches for this workspace
          vectorStoreCache.del(`vectorStore:${workspaceId}`);

          // Remove the QA chain for this workspace
          qaChains.delete(workspaceId);

          // Clear conversation histories for this workspace
          const keys = conversationHistory.keys();
          for (const key of keys) {
            if (key.startsWith(`${workspaceId}:`)) {
              conversationHistory.del(key);
            }
          }

          clearRetrieverCache(workspaceId);
          clearUserCache(); // Clear all user cache

          // Reinitialize vector store for this workspace
          const vs = await initVectorStore(workspaceId);
          vectorStoreCache.set(`vectorStore:${workspaceId}`, vs);

          // Recreate QA chain for this workspace
          const workspaceChain = await createQAChain(vs, workspaceId);
          qaChains.set(workspaceId, workspaceChain);

          return { success: true, workspaceId };
        } catch (error) {
          console.error(`Error refreshing vector store for job ${job.id}:`, error);
          throw error;
        }
      }
    });

    // Register shutdown handler
    registerShutdownHandler(async () => {
      console.log('[AI Routes] Closing Redis connections...');
      if (isRedisAvailable) {
        await worker?.close();
        await aiQueue?.close();
        await redisClient?.disconnect();
      }
    });
  } catch (err) {
    console.error('Redis connection error:', err);
    isRedisAvailable = false;
  }
})();

// Set up rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later',
});

// Apply middleware and rate limiting to all routes
router.use(limiter);
router.use(authenticate);
router.use(extractWorkspace);

// Helper function to extract answer from different result structures
function extractAnswer(result) {
  // Handle object responses
  if (result && result.answer) return result.answer;
  if (result && result.text) return result.text;
  if (result && result.response) return result.response;
  if (result && result.output) return result.output;

  // Convert to string if it's an object
  let textResult =
    typeof result === 'object' && result !== null ? JSON.stringify(result) : String(result);

  // If the answer contains the explicit "Answer:" prefix, extract only what follows
  if (textResult.includes('Answer:')) {
    return textResult.split('Answer:').pop().trim();
  }

  return textResult.trim();
}

// Async chat endpoint with queue processing
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId: providedSessionId } = req.body;
    const workspaceId = req.workspace._id.toString();
    const userId = req.user.userId;

    // Generate a new session ID if none provided
    const sessionId = providedSessionId || uuidv4();

    if (!message) {
      return res.status(400).json({ error: 'Missing `message` in request body.' });
    }

    // Get or create conversation from MongoDB
    let conversation;
    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
      conversation = await AIConversation.findOne({
        _id: sessionId,
        workspace: workspaceId,
      });
    }

    if (!conversation) {
      conversation = await AIConversation.create({
        workspace: workspaceId,
        messages: [],
        title: 'New Conversation',
      });
    }

    // Add user message
    const userMessage = {
      role: 'user',
      content: message,
    };
    conversation.messages.push(userMessage);

    // Get conversation history for context - use the messages array directly
    const history = conversation.messages;

    // For complex requests or high traffic, use queue if available
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.log(
      `Adding job ${jobId} to queue for message: "${message}" with sessionId: ${sessionId}`,
    );

    // Add job to queue with session info
    await aiQueue.add('process-query', {
      message,
      jobId,
      sessionId,
      workspaceId,
      history,
      userId,
    });

    // Return job ID for status checking
    return res.json({
      jobId,
      sessionId,
      status: 'processing',
      message: 'Request is being processed. Use the /chat/status/:jobId endpoint to check status.',
    });
  } catch (err) {
    console.error('Error in /chat endpoint:', err);
    return res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

// Streaming chat endpoint for real-time responses
router.post('/chat/stream', async (req, res) => {
  try {
    console.log('Received streaming chat request');
    const { message, sessionId: providedSessionId, pageContext } = req.body;
    const workspaceId = req.workspace._id.toString();
    const userId = req.user.userId;
    const currentPath = pageContext?.path;

    // Generate a new session ID if none provided
    const sessionId = providedSessionId || uuidv4();

    if (!message) {
      return res.status(400).json({ error: 'Missing `message` in request body.' });
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Get or create conversation from MongoDB
    let conversation;
    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
      conversation = await AIConversation.findOne({
        _id: sessionId,
        workspace: workspaceId,
      });
    }

    if (!conversation) {
      conversation = await AIConversation.create({
        workspace: workspaceId,
        messages: [],
        title: 'New Conversation',
      });
    }

    // Add user message
    const userMessage = {
      role: 'user',
      content: message,
    };
    conversation.messages.push(userMessage);

    // Get conversation history for context
    const history = conversation.messages;

    // Initialize QA chain if needed for this workspace
    if (!qaChains.has(workspaceId)) {
      console.log(`Initializing vector store and QA chain for workspace ${workspaceId}...`);

      // Check if vector store is cached
      let vs;
      if (vectorStoreCache.get(`vectorStore:${workspaceId}`)) {
        console.log('Using cached vector store for workspace');
        vs = vectorStoreCache.get(`vectorStore:${workspaceId}`);
      } else {
        console.log('Initializing new vector store for workspace...');
        vs = await initVectorStore(workspaceId);
        // Cache the vector store
        vectorStoreCache.set(`vectorStore:${workspaceId}`, vs);
      }

      console.log('Creating QA chain...');
      const workspaceChain = await createQAChain(vs, workspaceId);
      // Store chain by workspace ID
      qaChains.set(workspaceId, workspaceChain);
      console.log(`QA chain initialized for workspace ${workspaceId}`);
    }

    // Get the chain for this workspace
    const workspaceChain = qaChains.get(workspaceId);

    let streamStarted = false;
    let fullAnswer = '';

    try {
      // Use stream instead of invoke
      const stream = await workspaceChain.stream({
        query: message,
        history: history.map((h) => `Human: ${h.question}\nAI: ${h.answer}`).join('\n\n'),
        workspaceId,
        userId,
        currentPath,
      });

      // Stream each chunk to the client
      for await (const chunk of stream) {
        if (!streamStarted && chunk) {
          streamStarted = true;
        }

        fullAnswer += chunk;

        // Send chunk as SSE
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);

        // Flush to ensure delivery
        if (res.flush) {
          res.flush();
        }
      }

      // Add AI response to conversation
      const aiMessage = {
        role: 'assistant',
        content: fullAnswer,
      };
      conversation.messages.push(aiMessage);
      conversation.lastActive = new Date();
      await conversation.save();

      const endTime = Date.now();

      // Estimate cost
      const costEstimate = estimateQueryCost(message, fullAnswer);
      console.log(
        chalk.green(`💰 AI Streaming Query Cost Estimate: $${costEstimate.totalCost.toFixed(6)}`) +
          chalk.yellow(
            ` (Input: ~${costEstimate.inputTokens} tokens, Output: ~${
              costEstimate.outputTokens
            } tokens, Time: ${(endTime - startTime) / 1000}s)`,
          ),
      );

      // Send completion event
      res.write(
        `data: ${JSON.stringify({
          type: 'end',
          sessionId,
          processingTime: (endTime - startTime) / 1000,
        })}\n\n`,
      );

      // End response
      res.end();
    } catch (error) {
      console.error('Error in streaming chat:', error);
      if (!res.headersSent) {
        return res.status(500).json({
          error: error.message,
        });
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      }
    }
  } catch (err) {
    console.error('Error in /chat/stream endpoint:', err);
    if (!res.headersSent) {
      return res.status(500).json({
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    }
  }
});

// Streaming chat events endpoint for detailed chain execution
router.post('/chat/stream-events', async (req, res) => {
  try {
    console.log('Received streaming events chat request');
    const { message, sessionId: providedSessionId } = req.body;
    const workspaceId = req.workspace._id.toString();
    const userId = req.user.userId; // Get the authenticated user ID

    // Generate a new session ID if none provided
    const sessionId = providedSessionId || uuidv4();
    // Make sessionId workspace-specific
    const workspaceSessionId = `${workspaceId}:${sessionId}`;

    if (!message) {
      return res.status(400).json({ error: 'Missing `message` in request body.' });
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Prevents Nginx from buffering the response

    // Retrieve conversation history for this session
    let history = conversationHistory.get(workspaceSessionId) || [];

    // For new conversations or if cache was cleared, initialize history array
    if (!Array.isArray(history)) {
      history = [];
    }

    // Initialize QA chain if needed for this workspace
    if (!qaChains.has(workspaceId)) {
      console.log(`Initializing vector store and QA chain for workspace ${workspaceId}...`);

      // Check if vector store is cached
      let vs;
      if (vectorStoreCache.get(`vectorStore:${workspaceId}`)) {
        console.log('Using cached vector store for workspace');
        vs = vectorStoreCache.get(`vectorStore:${workspaceId}`);
      } else {
        console.log('Initializing new vector store for workspace...');
        vs = await initVectorStore(workspaceId);
        // Cache the vector store
        vectorStoreCache.set(`vectorStore:${workspaceId}`, vs);
      }

      console.log('Creating QA chain...');
      const workspaceChain = await createQAChain(vs, workspaceId);
      // Store chain by workspace ID
      qaChains.set(workspaceId, workspaceChain);
      console.log(`QA chain initialized for workspace ${workspaceId}`);
    }

    // Get the chain for this workspace
    const workspaceChain = qaChains.get(workspaceId);

    // Send initial event
    res.write(`data: ${JSON.stringify({ type: 'start', sessionId })}\n\n`);

    // Process query with streaming
    console.log(
      `Processing streaming events query: "${message}" with workspaceSessionId: ${workspaceSessionId}`,
    );
    const startTime = Date.now();

    let fullAnswer = '';
    let finalAnswer = '';
    let streamStarted = false;

    try {
      // Use astream_events instead of stream for detailed events
      const eventStream = await workspaceChain.astream_events({
        query: message,
        history: history.map((h) => `Human: ${h.question}\nAI: ${h.answer}`).join('\n\n'),
        workspaceId, // Pass workspaceId for context
        userId, // Pass userId for personalization
      });

      // Stream each event to the client
      for await (const event of eventStream) {
        // Send the event data as SSE
        res.write(
          `data: ${JSON.stringify({
            type: 'event',
            event: event.event,
            name: event.name,
            data: event.data,
          })}\n\n`,
        );

        // Extract answer chunks from model stream events
        if (event.event === 'on_chat_model_stream' && event.data && event.data.chunk) {
          if (!streamStarted) {
            streamStarted = true;
          }

          const content = event.data.chunk.content || '';
          if (content) {
            fullAnswer += content;
            res.write(
              `data: ${JSON.stringify({
                type: 'chunk',
                content: content,
              })}\n\n`,
            );
          }
        }

        // Save final answer when completed
        if (event.event === 'on_chain_end') {
          if (event.data && event.data.output) {
            finalAnswer = extractAnswer(event.data.output);
          }
        }

        // Flush to ensure delivery
        if (res.flush) {
          res.flush();
        }
      }

      // Use the most appropriate answer (finalAnswer or fullAnswer)
      const answer = finalAnswer || fullAnswer;

      // Update conversation history with the complete answer
      history.push({ question: message, answer });

      // Limit history size to prevent token overflow (keep last 10 exchanges)
      if (history.length > 10) {
        history = history.slice(history.length - 10);
      }

      // Save updated history
      conversationHistory.set(workspaceSessionId, history);

      const endTime = Date.now();

      // Estimate cost
      const costEstimate = estimateQueryCost(message, answer);
      console.log(
        chalk.green(
          `💰 AI Streaming Events Query Cost Estimate: $${costEstimate.totalCost.toFixed(6)}`,
        ) +
          chalk.yellow(
            ` (Input: ~${costEstimate.inputTokens} tokens, Output: ~${
              costEstimate.outputTokens
            } tokens, Time: ${(endTime - startTime) / 1000}s)`,
          ),
      );

      // Send completion event
      res.write(
        `data: ${JSON.stringify({
          type: 'end',
          sessionId,
          processingTime: (endTime - startTime) / 1000,
          answer,
        })}\n\n`,
      );

      // End response
      res.end();
    } catch (error) {
      console.error('Error in streaming events:', error);
      // Send error event
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  } catch (err) {
    console.error('Error in /chat/stream-events endpoint:', err);
    if (!res.headersSent) {
      return res.status(500).json({
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    }
  }
});

// Endpoint to check job status - update to include session information
router.get('/chat/status/:jobId', async (req, res) => {
  try {
    if (!isRedisAvailable) {
      return res.status(503).json({
        error: 'Queue service unavailable',
        message: 'Redis is not available. Job status checking is not possible.',
      });
    }

    const jobId = req.params.jobId;
    const workspaceId = req.workspace._id.toString();
    console.log(`Checking status for job ${jobId} in workspace ${workspaceId}`);

    const job = await aiQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify job belongs to this workspace
    if (job.data.workspaceId !== workspaceId) {
      return res.status(403).json({ error: 'Job not found in this workspace' });
    }

    const state = await job.getState();

    if (state === 'completed') {
      const result = job.returnvalue;

      return res.json({
        status: state,
        answer: result.answer,
        sessionId: result.sessionId || job.data.sessionId,
      });
    }

    return res.json({
      status: state,
      message: state === 'failed' ? 'Processing failed' : 'Still processing',
      sessionId: job.data.sessionId,
    });
  } catch (err) {
    console.error('Error in status endpoint:', err);
    return res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

// Add a new endpoint to clear conversation history
router.delete('/chat/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const workspaceId = req.workspace._id.toString();

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId parameter' });
    }

    // Delete the conversation from MongoDB
    await AIConversation.findOneAndDelete({
      _id: sessionId,
      workspace: workspaceId,
    });

    return res.json({
      status: 'success',
      message: 'Conversation history cleared',
    });
  } catch (err) {
    console.error('Error clearing conversation history:', err);
    return res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

// Add a refresh endpoint to update the vector store
router.post('/refresh', async (req, res) => {
  try {
    const workspaceId = req.body.workspaceId || req.workspace._id.toString();

    // Only allow authorized requests
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // If Redis is not available, perform direct refresh
    if (!isRedisAvailable) {
      try {
        // Close existing vector store connections for this workspace
        await closeVectorStore(workspaceId);

        // Clear caches for this workspace
        vectorStoreCache.del(`vectorStore:${workspaceId}`);

        // Remove the QA chain for this workspace
        qaChains.delete(workspaceId);

        // Clear conversation histories for this workspace
        const keys = conversationHistory.keys();
        for (const key of keys) {
          if (key.startsWith(`${workspaceId}:`)) {
            conversationHistory.del(key);
          }
        }

        clearRetrieverCache(workspaceId);
        clearUserCache(); // Clear all user cache during refresh

        // Reinitialize vector store for this workspace
        const vs = await initVectorStore(workspaceId);
        vectorStoreCache.set(`vectorStore:${workspaceId}`, vs);

        // Recreate QA chain for this workspace
        const workspaceChain = await createQAChain(vs, workspaceId);
        qaChains.set(workspaceId, workspaceChain);

        console.log(`Vector store refresh completed successfully for workspace ${workspaceId}`);
        return res.json({
          status: 'completed',
          message: 'Vector store refresh completed',
        });
      } catch (error) {
        console.error(
          `Error during direct vector store refresh for workspace ${workspaceId}:`,
          error,
        );
        return res.status(500).json({
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
      }
    }

    // Start a background job to refresh the vector store
    const jobId = `refresh-${workspaceId}-${Date.now()}`;
    await aiQueue.add('refresh-vector-store', { jobId, workspaceId });

    return res.json({
      status: 'refreshing',
      message: 'Vector store refresh started',
      jobId,
    });
  } catch (err) {
    console.error('Error in /refresh endpoint:', err);
    return res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

// Endpoint to check the status of a refresh job
router.get('/refresh/status/:jobId', async (req, res) => {
  try {
    if (!isRedisAvailable) {
      return res.status(503).json({
        error: 'Queue service unavailable',
        message: 'Redis is not available. Job status checking is not possible.',
      });
    }

    const jobId = req.params.jobId;
    const workspaceId = req.workspace._id.toString();
    const job = await aiQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify job belongs to this workspace
    if (job.data.workspaceId !== workspaceId) {
      return res.status(403).json({ error: 'Job not found in this workspace' });
    }

    const state = await job.getState();

    return res.json({
      status: state,
      message:
        state === 'completed'
          ? 'Vector store refresh completed'
          : state === 'failed'
          ? 'Vector store refresh failed'
          : 'Vector store refresh in progress',
    });
  } catch (err) {
    console.error('Error in refresh status endpoint:', err);
    return res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

// Helper function to determine if traffic is low
async function isLowTraffic() {
  // If Redis is not available, consider it low traffic
  if (!isRedisAvailable) {
    return true;
  }

  // This is a simplified implementation
  try {
    const activeJobs = await aiQueue.getActiveCount();
    const waitingJobs = await aiQueue.getWaitingCount();

    // If there are fewer than 5 active and waiting jobs combined, consider it low traffic
    return activeJobs + waitingJobs < 5;
  } catch (err) {
    console.error('Error checking traffic level:', err);
    // Default to direct processing in case of error
    return true;
  }
}

// Helper function to prepare email context for AI processing
async function prepareEmailContext(emails, workspaceId, options = {}) {
  try {
    // Handle case where emails is passed as a JSON string
    let emailsArray = emails;
    if (typeof emails === 'string') {
      try {
        emailsArray = JSON.parse(emails);
        console.log(
          'Successfully parsed emails string into array:',
          Array.isArray(emailsArray)
            ? `Array with ${emailsArray.length} items`
            : typeof emailsArray,
        );
      } catch (parseError) {
        console.error('Failed to parse emails string as JSON:', parseError);
        return '\n--- ERROR: Invalid email data format ---\n';
      }
    }

    // Ensure we're working with an array
    if (!Array.isArray(emailsArray) || emailsArray.length === 0) {
      console.log('No valid email array data after processing');
      return '';
    }

    // Format emails into a structured context
    let context = '\n--- EMAIL CONTEXT ---\n';

    emailsArray.forEach((email, index) => {
      context += `\nEmail ${index + 1}:\n`;
      context += `From: ${email.from || 'Unknown'}\n`;
      context += `To: ${Array.isArray(email.to) ? email.to.join(', ') : email.to || 'Unknown'}\n`;
      context += `Subject: ${email.subject || 'No Subject'}\n`;
      context += `Date: ${email.date || 'Unknown'}\n`;

      // Add email body
      if (email.text) {
        context += `Body:\n${email.text}\n`;
      } else if (email.html) {
        // Simple HTML to text conversion
        const plainText = email.html.replace(/<[^>]*>/g, '');
        context += `Body:\n${plainText}\n`;
      } else {
        context += `Body: No content available\n`;
      }

      // Add email attachments if any
      if (email.attachments && email.attachments.length > 0) {
        context += `Attachments: ${email.attachments.map((a) => a.filename).join(', ')}\n`;
      }

      context += '---\n';
    });

    // Add a closing indicator
    context += '--- END EMAIL CONTEXT ---\n';

    return context;
  } catch (error) {
    console.error('Error formatting email context:', error);
    return '\n--- ERROR: Failed to process email context ---\n';
  }
}

// Smart response endpoint that intelligently handles both line items and general responses
router.post('/smart-response', imageUpload.array('images', 5), async (req, res) => {
  try {
    const { prompt, history, emails } = req.body;
    const workspaceId = req.workspace._id.toString();
    const userId = req.user.userId;

    console.log('📬 Smart-response request with emails:', {
      emailsPresent: !!emails,
      emailsType: typeof emails,
      emailsLength: emails?.length,
      emailsData: Array.isArray(emails)
        ? emails.map((e) => ({ id: e.id, subject: e.subject }))
        : 'not an array',
    });

    // Input validation and size checks
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt in request body' });
    }

    // Check prompt length (adjust max length based on your needs)
    const MAX_PROMPT_LENGTH = 10000; // ~2500 words
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({
        error: 'Prompt too long',
        message: `Maximum prompt length is ${MAX_PROMPT_LENGTH} characters`,
      });
    }

    // Process images if any were uploaded
    const files = req.files || [];
    const imageUrls = [];

    if (files.length > 0) {
      try {
        for (const file of files) {
          const fileName = `ai-uploads/${workspaceId}/${Date.now()}-${file.originalname}`;
          const uploadResult = await firebaseStorage.uploadFile(
            file.buffer,
            fileName,
            file.mimetype,
          );
          imageUrls.push(uploadResult.url);
        }
        console.log(`Uploaded ${imageUrls.length} images for AI processing`);
      } catch (error) {
        console.error('Error uploading images:', error);
        return res.status(500).json({
          error: 'Failed to process images',
          message: error.message,
        });
      }
    }

    // Process emails parameter if present
    let emailContext = '';
    if (emails) {
      console.log('📧 Email data received for processing:', {
        type: typeof emails,
        length: emails?.length,
        sample: typeof emails === 'string' ? emails.substring(0, 50) + '...' : 'not a string',
      });

      try {
        // Parse emails from JSON string if necessary
        let parsedEmails = emails;

        // If it's a string, try to parse it as JSON
        if (typeof emails === 'string') {
          try {
            parsedEmails = JSON.parse(emails);
            console.log('Successfully parsed emails JSON string:', {
              resultType: typeof parsedEmails,
              isArray: Array.isArray(parsedEmails),
              length: parsedEmails?.length,
            });
          } catch (parseError) {
            console.error('Failed to parse emails JSON:', parseError);
            parsedEmails = [];
          }
        }

        // Now process the emails
        emailContext = await prepareEmailContext(parsedEmails, workspaceId, {
          allowMockData: true,
        });
        console.log(`📨 Email context generated (${emailContext.length} chars)`);
      } catch (err) {
        console.error('❌ Error processing email context:', err);
        emailContext = '\n--- EMAIL CONTEXT: Failed to process emails ---\n';
      }
    } else {
      console.log('ℹ️ No emails provided for context');
    }

    // Check history length and size
    if (history && Array.isArray(history)) {
      const MAX_HISTORY_ITEMS = 20;
      if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(-MAX_HISTORY_ITEMS); // Keep only the most recent items
      }

      // Check total history size
      const totalHistorySize = history.reduce((acc, item) => {
        return acc + (item.question?.length || 0) + (item.answer?.length || 0);
      }, 0);

      const MAX_HISTORY_SIZE = 50000; // ~12500 words
      if (totalHistorySize > MAX_HISTORY_SIZE) {
        return res.status(400).json({
          error: 'History too large',
          message: 'Total conversation history exceeds maximum allowed size',
        });
      }
    }

    // Check if we're under heavy load
    if (!isLowTraffic()) {
      return res.status(429).json({
        error: 'Service busy',
        message: 'Server is currently under heavy load. Please try again in a few moments.',
      });
    }

    // Initialize QA chain if needed for this workspace
    if (!qaChains.has(workspaceId)) {
      // Check if vector store is cached
      let vs;
      if (vectorStoreCache.get(`vectorStore:${workspaceId}`)) {
        vs = vectorStoreCache.get(`vectorStore:${workspaceId}`);
      } else {
        vs = await initVectorStore(workspaceId);
        // Cache the vector store
        vectorStoreCache.set(`vectorStore:${workspaceId}`, vs);
      }

      const workspaceChain = await createQAChain(vs, workspaceId);
      // Store chain by workspace ID
      qaChains.set(workspaceId, workspaceChain);
    }

    // Get the chain for this workspace
    const workspaceChain = qaChains.get(workspaceId);

    // Set a timeout for the processing
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Request timeout - processing took too long'));
      }, 30000); // 30 second timeout
    });

    // Process the smart response with timeout - pass emails as parameter
    const result = await Promise.race([
      processSmartResponse(
        prompt,
        workspaceChain,
        workspaceId,
        userId,
        history,
        imageUrls,
        emailContext,
      ),
      timeoutPromise,
    ]);

    // Check response size
    const MAX_RESPONSE_SIZE = 20000; // ~5000 words
    if (result && result.answer && result.answer.length > MAX_RESPONSE_SIZE) {
      result.answer = result.answer.substring(0, MAX_RESPONSE_SIZE) + '... (response truncated)';
    }

    // Return the result
    return res.json(result);
  } catch (err) {
    console.error('Error in /smart-response endpoint:', err);

    // Handle timeout specifically
    if (err.message.includes('timeout')) {
      return res.status(504).json({
        error: 'Request timeout',
        message: 'The request took too long to process. Please try again with a simpler prompt.',
      });
    }

    return res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

export default router;
