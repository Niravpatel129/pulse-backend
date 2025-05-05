import { Queue, Worker } from 'bullmq';
import chalk from 'chalk';
import express from 'express';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import Redis from 'redis';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../../middleware/auth.js';
import { extractWorkspace } from '../../middleware/workspace.js';
import { clearRetrieverCache, clearUserCache, createQAChain } from './chain.js';
import { closeVectorStore, initVectorStore } from './vectorStore.js';

const router = express.Router();

// Store chains by workspace ID instead of a single global chain
const qaChains = new Map();

// Export qaChains so it can be accessed by other modules
export { qaChains };

// Create caches with TTL
const vectorStoreCache = new NodeCache({ stdTTL: 3600 }); // 1 hour
const conversationHistory = new NodeCache({ stdTTL: 1800 }); // 30 minutes

// Variables for message queue
let aiQueue;
let worker;
let redisClient;
let isRedisAvailable = false;

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
      console.log('No Redis URL found in environment variables. Running without Redis.');
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
          const { message, jobId, sessionId, workspaceId, workspaceSessionId, history, userId } =
            job.data;
          console.log(
            `Processing job ${jobId} with message: "${message}" for workspace: ${workspaceId}, session: ${sessionId}`,
          );

          // Initialize QA chain if not already done for this workspace
          if (!qaChains.has(workspaceId)) {
            console.log(
              `Initializing vector store and QA chain for workspace ${workspaceId} from worker...`,
            );

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

          // Get current conversation history
          let sessionHistory = history || conversationHistory.get(workspaceSessionId) || [];

          // Process query with conversation context
          console.log(`Worker processing query: "${message}"`);
          const startTime = Date.now();
          const result = await workspaceChain.invoke({
            query: message,
            history: sessionHistory
              .map((h) => `Human: ${h.question}\nAI: ${h.answer}`)
              .join('\n\n'),
            workspaceId, // Pass workspaceId for context
            userId, // Pass userId for personalization
          });
          const endTime = Date.now();
          console.log('Successfully generated answer');

          // Extract and prepare answer
          const answer = extractAnswer(result);

          // Update conversation history
          sessionHistory.push({ question: message, answer });

          // Limit history size to prevent token overflow
          if (sessionHistory.length > 10) {
            sessionHistory = sessionHistory.slice(sessionHistory.length - 10);
          }

          // Save updated history
          conversationHistory.set(workspaceSessionId, sessionHistory);

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

          console.log(`Vector store refresh completed for workspace ${workspaceId}, job ${job.id}`);
          return { success: true, workspaceId };
        } catch (error) {
          console.error(`Error refreshing vector store for job ${job.id}:`, error);
          throw error;
        }
      }
    });
  } catch (err) {
    console.error('Redis connection error:', err);
    console.log('Continuing without Redis - queue processing will be unavailable');
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
    console.log('Received chat request');
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

    // Retrieve conversation history for this session
    let history = conversationHistory.get(workspaceSessionId) || [];

    // For new conversations or if cache was cleared, initialize history array
    if (!Array.isArray(history)) {
      history = [];
    }

    // If Redis is unavailable, or traffic is low, process directly
    if (!isRedisAvailable || (await isLowTraffic())) {
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

      // Process query directly with conversation history
      console.log(`Processing query directly: "${message}" with sessionId: ${workspaceSessionId}`);
      const startTime = Date.now();

      // Add history to the query context
      const result = await workspaceChain.invoke({
        query: message,
        history: history.map((h) => `Human: ${h.question}\nAI: ${h.answer}`).join('\n\n'),
        workspaceId, // Pass workspaceId for context
        userId, // Pass userId for personalization
      });

      const endTime = Date.now();
      console.log('Successfully generated answer');

      // Extract answer
      const answer = extractAnswer(result);

      // Update conversation history
      history.push({ question: message, answer });

      // Limit history size to prevent token overflow (keep last 10 exchanges)
      if (history.length > 10) {
        history = history.slice(history.length - 10);
      }

      // Save updated history
      conversationHistory.set(workspaceSessionId, history);

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

      return res.json({
        answer,
        sessionId, // Return sessionId for client to use in follow-up questions
      });
    }

    // For complex requests or high traffic, use queue if available
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.log(
      `Adding job ${jobId} to queue for message: "${message}" with workspaceSessionId: ${workspaceSessionId}`,
    );

    // Add job to queue with session info
    await aiQueue.add('process-query', {
      message,
      jobId,
      sessionId,
      workspaceId,
      workspaceSessionId,
      history,
      userId, // Add userId to job data
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
    const userId = req.user.userId; // Get the authenticated user ID
    const currentPath = pageContext?.path;

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
      `Processing streaming query: "${message}" with workspaceSessionId: ${workspaceSessionId}`,
    );
    const startTime = Date.now();

    let fullAnswer = '';
    let streamStarted = false;

    try {
      // Use stream instead of invoke
      const stream = await workspaceChain.stream({
        query: message,
        history: history.map((h) => `Human: ${h.question}\nAI: ${h.answer}`).join('\n\n'),
        workspaceId, // Pass workspaceId for context
        userId, // Pass userId for personalization
        currentPath, // Pass current page path for context
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

      // Update conversation history with the complete answer
      history.push({ question: message, answer: fullAnswer });

      // Limit history size to prevent token overflow (keep last 10 exchanges)
      if (history.length > 10) {
        history = history.slice(history.length - 10);
      }

      // Save updated history
      conversationHistory.set(workspaceSessionId, history);

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
      console.error('Error in streaming:', error);
      // Send error event
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
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
    const workspaceSessionId = `${workspaceId}:${sessionId}`;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId parameter' });
    }

    // Delete the conversation history for this session
    conversationHistory.del(workspaceSessionId);

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
    console.log('Received refresh request');
    const workspaceId = req.body.workspaceId || req.workspace._id.toString();

    // Only allow authorized requests
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`Refreshing vector store for workspace: ${workspaceId}`);

    // If Redis is not available, perform direct refresh
    if (!isRedisAvailable) {
      console.log(
        `Performing direct vector store refresh for workspace ${workspaceId} (Redis unavailable)`,
      );
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

// Endpoint to process natural language into line items
router.post('/line-items', async (req, res) => {
  try {
    console.log('Received line items generation request');
    const { prompt } = req.body;
    const workspaceId = req.workspace._id.toString();
    const userId = req.user.userId;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt in request body' });
    }

    console.log(`Processing line items for prompt: "${prompt}"`);

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

    const startTime = Date.now();

    // First, check if we need to get item data from tables
    const needsTableLookup =
      prompt.toLowerCase().includes('service') ||
      prompt.toLowerCase().includes('line item called') ||
      /\b(dtf|called|named)\b/i.test(prompt);

    // Try to get service data from tables if needed
    let serviceContextData = '';
    if (needsTableLookup) {
      try {
        console.log('Attempting to retrieve service information from tables');
        // Use the existing retrieval system to get information from tables
        const tableContext = await workspaceChain.invoke({
          query: `Find information about services or table data that might include "${
            prompt.toLowerCase().includes('dtf') ? 'dtf' : 'service'
          }" items`,
          workspaceId,
          userId,
          context_only: true,
        });

        if (tableContext && typeof tableContext === 'string') {
          serviceContextData = `SERVICE DATA CONTEXT:\n${tableContext}\n\nUse this context to populate service line items that match the names in the prompt.`;
          console.log('Retrieved service data context');
        }
      } catch (error) {
        console.error('Error retrieving service information:', error);
      }
    }

    // Direct approach to get line items with careful handling of both products and services
    try {
      // Create custom prompt for direct line item extraction
      const directPrompt = `
 ONLY OUTPUT VALID JSON. Do not include any explanatory text before or after the JSON.
 Your task is to extract product and service line items from this request: "${prompt}"
 
 ${serviceContextData}
 
 Categorize each item as either PRODUCT or SERVICE based on the description.
 If an item is described as a service or is called/named something without physical attributes, treat it as a SERVICE.
 Products are physical items like clothing.
 
 Format your response EXACTLY like this:
 {"lineItems":[{"name":"Item Name","description":"Item Description","price":"$XX.XX","type":"PRODUCT/SERVICE","reasoning":"Explanation of where the name, price, and description were derived from"}]}
 
 For pricing: Use the mentioned price or a reasonable estimate.
 For service items: If the price isn't mentioned, use $50.00 as default.
 For product items: Include relevant details like color in the name and description.
 Make sure to include ALL items mentioned in the prompt.

 For the reasoning field, explain:
 1. Where you got the name from (extracted from prompt, database, or generated)
 2. How you determined the price (explicit in prompt, estimated, or default)
 3. How you created the description (based on product type, extracted from database, etc.)
 
 Example correct format:
 {"lineItems":[{"name":"Red Hoodie","description":"Red cotton hoodie with front pocket","price":"$19.99","type":"PRODUCT","reasoning":"Name derived from 'red hoodie' in prompt. Price estimated based on market value. Description generated based on standard hoodie features."}]}
 `;

      // Make direct API call with stringent formatting requirements
      const result = await workspaceChain.invoke({
        query: directPrompt,
        workspaceId,
        userId,
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const endTime = Date.now();
      console.log('Line items result received:', typeof result);

      // Extract the lineItems from the result
      let lineItems = [];
      let rawResponse = '';

      if (typeof result === 'string') {
        rawResponse = result;
        // Try to find and extract only valid JSON object pattern
        const jsonPattern = /(\{[\s\S]*\})/g;
        const matches = result.match(jsonPattern);

        if (matches && matches.length > 0) {
          try {
            const jsonData = JSON.parse(matches[0]);
            if (jsonData.lineItems) {
              lineItems = jsonData.lineItems;
            }
          } catch (parseError) {
            console.error('Error parsing JSON pattern:', parseError);
            throw new Error('Invalid JSON format in response');
          }
        } else {
          throw new Error('No valid JSON pattern found in response');
        }
      } else if (typeof result === 'object' && result.lineItems) {
        lineItems = result.lineItems;
      } else if (Array.isArray(result)) {
        lineItems = result;
      } else {
        throw new Error('Unexpected response structure');
      }

      if (!lineItems || lineItems.length === 0) {
        throw new Error('No line items found in response');
      }

      // Process the line items to ensure proper formatting
      lineItems = lineItems.map((item) => ({
        name: item.name || 'Unnamed Item',
        description: item.description || 'No description provided',
        price: item.price || (item.type === 'SERVICE' ? '$50.00' : '$19.99'),
        type: item.type || 'PRODUCT',
        reasoning:
          item.reasoning ||
          `Name, price, and description derived from AI analysis of the prompt: "${prompt}".`,
      }));

      // Estimate cost
      const responseText = JSON.stringify(lineItems);
      const costEstimate = estimateQueryCost(prompt, responseText);
      console.log(
        chalk.green(
          `💰 Line Items Generation Cost Estimate: $${costEstimate.totalCost.toFixed(6)}`,
        ) +
          chalk.yellow(
            ` (Input: ~${costEstimate.inputTokens} tokens, Output: ~${
              costEstimate.outputTokens
            } tokens, Time: ${(endTime - startTime) / 1000}s)`,
          ),
      );

      // Return structured response
      return res.json({
        lineItems,
        meta: {
          processingTime: (endTime - startTime) / 1000,
          promptLength: prompt.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error with line items generation:', error);
      console.log('Falling back to manual extraction...');

      // Use the fallback extraction with improved service item detection
      const products = extractProductsFromPrompt(prompt);

      const endTime = Date.now();
      return res.json({
        lineItems: products,
        meta: {
          processingTime: (endTime - startTime) / 1000,
          promptLength: prompt.length,
          timestamp: new Date().toISOString(),
          fallback: true,
          error: error.message,
        },
      });
    }
  } catch (err) {
    console.error('Error in /line-items endpoint:', err);
    return res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

// Helper function to extract multiple products from a prompt
function extractProductsFromPrompt(prompt) {
  const products = [];

  // Split by "and" to identify multiple products
  const productSegments = prompt.split(/,\s*and\s*|\s*and\s*|,\s*/);

  productSegments.forEach((segment) => {
    const trimmedSegment = segment.trim();
    if (!trimmedSegment) return;

    // Check if this is a service item
    const isService =
      trimmedSegment.includes('service') ||
      /\b(called|named)\s+([a-zA-Z0-9]+)\b/i.test(trimmedSegment);

    if (isService) {
      // Extract service name
      let serviceName = 'Generic Service';
      const serviceNameMatch = trimmedSegment.match(/\b(called|named)\s+([a-zA-Z0-9]+)\b/i);
      if (serviceNameMatch && serviceNameMatch[2]) {
        serviceName = serviceNameMatch[2];
      } else if (trimmedSegment.includes('dtf')) {
        serviceName = 'DTF Service';
      }

      // Extract price if mentioned
      const priceMatch = trimmedSegment.match(/\$\s*(\d+(?:\.\d+)?)/);
      const price = priceMatch ? `$${parseFloat(priceMatch[1]).toFixed(2)}` : '$50.00';

      // Build reasoning explanation
      let reasoning = `Name derived from `;
      if (serviceNameMatch && serviceNameMatch[2]) {
        reasoning += `explicit "called ${serviceNameMatch[2]}" in prompt. `;
      } else if (trimmedSegment.includes('dtf')) {
        reasoning += `"dtf" mention in prompt. `;
      } else {
        reasoning += `fallback to generic service name. `;
      }

      reasoning += `Price ${
        priceMatch ? 'extracted from prompt' : 'set to default service price ($50.00)'
      }. `;
      reasoning += `Description generated as generic service description.`;

      products.push({
        name: serviceName,
        description: `Service item as requested by customer`,
        price: price,
        type: 'SERVICE',
        reasoning: reasoning,
      });

      return;
    }

    // Extract product type
    const typeMatches = trimmedSegment.match(
      /\b(hoodie|shirt|pants|jacket|sweater|hat|cap|beanie|t-shirt|sweatshirt)\b/i,
    );
    if (!typeMatches) return;

    const productType = typeMatches[1].toLowerCase();

    // Extract color
    const colorMatch = trimmedSegment.match(
      /\b(red|blue|green|black|white|gray|purple|yellow|orange|pink|brown)\b/i,
    );
    const color = colorMatch ? colorMatch[1] : null;

    // Extract price
    const priceMatch = trimmedSegment.match(/\$\s*(\d+(?:\.\d+)?)/);
    const priceMentionMatch = trimmedSegment.match(/(?:cost|price|around|about)\s+\$?(\d+)/i);

    // Extract additional descriptors
    const descriptorMatch = trimmedSegment.match(
      /\b(turtle|full[\s-]zip|pullover|graphic|cotton|polyester|wool|denim|regular)\b/i,
    );
    const descriptor = descriptorMatch ? descriptorMatch[1] : null;

    // Construct product name
    let name = '';
    if (color) name += `${color.charAt(0).toUpperCase() + color.slice(1)} `;
    if (descriptor) name += `${descriptor.charAt(0).toUpperCase() + descriptor.slice(1)} `;
    name += productType.charAt(0).toUpperCase() + productType.slice(1);

    // Generate product description
    let description;
    switch (productType) {
      case 'hoodie':
        description = `Comfortable ${color || ''} cotton-blend hoodie with ${
          trimmedSegment.includes('zip') ? 'full-length zipper' : 'pullover design'
        }, kangaroo pockets and adjustable hood${
          descriptor ? `, featuring a ${descriptor} design` : ''
        }.`;
        break;
      case 'shirt':
        description = `Classic ${color || ''} ${
          trimmedSegment.includes('regular') ? 'regular fit' : 'standard'
        } shirt made of soft, breathable cotton with reinforced stitching.`;
        break;
      default:
        description = `Quality ${
          color || ''
        } ${productType} with standard features and comfortable fit.`;
    }

    // Set price
    let price;
    let priceSource = '';
    if (priceMatch) {
      // Exact price
      price = `$${parseFloat(priceMatch[1]).toFixed(2)}`;
      priceSource = `extracted from exact price in prompt ($${priceMatch[1]})`;
    } else if (priceMentionMatch) {
      // Approximate price
      const basePrice = parseFloat(priceMentionMatch[1]);
      price = `$${(basePrice + 0.99).toFixed(2)}`;
      priceSource = `derived from approximate price in prompt (about $${priceMentionMatch[1]})`;
    } else {
      // Default prices
      const defaultPrices = {
        hoodie: 19.99,
        shirt: 15.99,
        pants: 24.99,
        jacket: 39.99,
        sweater: 29.99,
        hat: 14.99,
        cap: 12.99,
        beanie: 11.99,
        't-shirt': 12.99,
        sweatshirt: 17.99,
      };
      price = `$${defaultPrices[productType] || 19.99}`;
      priceSource = `set to default price for ${productType} products ($${
        defaultPrices[productType] || 19.99
      })`;
    }

    // Build reasoning explanation
    let reasoning = `Name constructed from `;
    const nameComponents = [];
    if (color) nameComponents.push(`color ("${color}")`);
    if (descriptor) nameComponents.push(`descriptor ("${descriptor}")`);
    nameComponents.push(`product type ("${productType}")`);
    reasoning += nameComponents.join(', ') + ` extracted from prompt. `;

    reasoning += `Price ${priceSource}. `;

    reasoning += `Description generated based on standard ${productType} features`;
    if (color) reasoning += `, including color`;
    if (descriptor) reasoning += ` and ${descriptor} characteristics`;
    reasoning += `.`;

    products.push({
      name,
      description,
      price,
      type: 'PRODUCT',
      reasoning: reasoning,
    });
  });

  // If no products were extracted, provide a fallback
  if (products.length === 0) {
    products.push({
      name: 'Generic Product',
      description: 'Product based on customer request.',
      price: '$19.99',
      type: 'PRODUCT',
      reasoning:
        'Generated as fallback when no specific products could be identified in the prompt.',
    });
  }

  return products;
}

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

// Clean up when shutting down
process.on('SIGTERM', async () => {
  if (isRedisAvailable) {
    try {
      await worker?.close();
      await aiQueue?.close();
      await redisClient?.disconnect();
      console.log('Worker and queue closed');
    } catch (err) {
      console.error('Error during shutdown:', err);
    }
  }
});

export default router;
