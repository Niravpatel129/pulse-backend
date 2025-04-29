import { Queue, Worker } from 'bullmq';
import chalk from 'chalk';
import express from 'express';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import Redis from 'redis';
import { clearRetrieverCache, createQAChain } from './chain.js';
import { closeVectorStore, initVectorStore } from './vectorStore.js';

const router = express.Router();
let qaChain;

// Create caches with TTL
const vectorStoreCache = new NodeCache({ stdTTL: 3600 }); // 1 hour
const queryCache = new NodeCache({ stdTTL: 300 }); // 5 minutes

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
          const { message, jobId } = job.data;
          console.log(`Processing job ${jobId} with message: "${message}"`);

          // Initialize QA chain if not already done
          if (!qaChain) {
            console.log('Initializing vector store and QA chain from worker...');

            // Check if vector store is cached
            let vs;
            if (vectorStoreCache.get('vectorStore')) {
              console.log('Using cached vector store');
              vs = vectorStoreCache.get('vectorStore');
            } else {
              console.log('Initializing new vector store...');
              vs = await initVectorStore();
              // Cache the vector store
              vectorStoreCache.set('vectorStore', vs);
            }

            console.log('Creating QA chain...');
            qaChain = createQAChain(vs);
            console.log('QA chain initialized:', !!qaChain);
          }

          // Process query
          console.log(`Worker processing query: "${message}"`);
          const startTime = Date.now();
          const result = await qaChain.invoke({ query: message });
          const endTime = Date.now();
          console.log('Successfully generated answer');

          // Extract and prepare answer
          const answer = extractAnswer(result);

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
          return answer;
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
          // Close existing vector store connections
          await closeVectorStore();

          // Clear caches
          vectorStoreCache.del('vectorStore');
          queryCache.flushAll();
          clearRetrieverCache();

          // Reset the QA chain
          qaChain = null;

          // Reinitialize vector store
          const vs = await initVectorStore();
          vectorStoreCache.set('vectorStore', vs);

          // Recreate QA chain
          qaChain = createQAChain(vs);

          console.log(`Vector store refresh completed for job ${job.id}`);
          return { success: true };
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

// Apply rate limiting to all routes
router.use(limiter);

// Helper function to extract answer from different result structures
function extractAnswer(result) {
  if (result && result.answer) return result.answer;
  if (result && result.text) return result.text;
  if (result && result.response) return result.response;
  if (result && result.output) return result.output;
  if (result && typeof result === 'object') return JSON.stringify(result);
  return String(result);
}

// Async chat endpoint with queue processing
router.post('/chat', async (req, res) => {
  try {
    console.log('Received chat request');
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Missing `message` in request body.' });
    }

    // Check if response is already cached
    const cacheKey = `query_${message}`;
    const cachedResult = queryCache.get(cacheKey);
    if (cachedResult) {
      console.log(chalk.blue('✓ Returning cached response (no AI cost incurred)'));
      return res.json({ answer: cachedResult });
    }

    // If Redis is unavailable, or traffic is low, process directly
    if (!isRedisAvailable || (await isLowTraffic())) {
      // Initialize QA chain if needed
      if (!qaChain) {
        console.log('Initializing vector store and QA chain for direct processing...');

        // Check if vector store is cached
        let vs;
        if (vectorStoreCache.get('vectorStore')) {
          console.log('Using cached vector store');
          vs = vectorStoreCache.get('vectorStore');
        } else {
          console.log('Initializing new vector store...');
          vs = await initVectorStore();
          // Cache the vector store
          vectorStoreCache.set('vectorStore', vs);
        }

        console.log('Creating QA chain...');
        qaChain = createQAChain(vs);
        console.log('QA chain initialized:', !!qaChain);
      }

      // Process query directly
      console.log(`Processing query directly: "${message}"`);
      const startTime = Date.now();
      const result = await qaChain.invoke({ query: message });
      const endTime = Date.now();
      console.log('Successfully generated answer');

      // Extract answer
      const answer = extractAnswer(result);

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

      // Cache the result
      queryCache.set(cacheKey, answer);

      return res.json({ answer });
    }

    // For complex requests or high traffic, use queue if available
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.log(`Adding job ${jobId} to queue for message: "${message}"`);

    // Add job to queue
    await aiQueue.add('process-query', { message, jobId });

    // Return job ID for status checking
    return res.json({
      jobId,
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

// Endpoint to check job status
router.get('/chat/status/:jobId', async (req, res) => {
  try {
    if (!isRedisAvailable) {
      return res.status(503).json({
        error: 'Queue service unavailable',
        message: 'Redis is not available. Job status checking is not possible.',
      });
    }

    const jobId = req.params.jobId;
    console.log(`Checking status for job ${jobId}`);

    const job = await aiQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();

    if (state === 'completed') {
      const result = job.returnvalue;

      // Cache the completed result
      const originalMessage = job.data.message;
      const cacheKey = `query_${originalMessage}`;
      queryCache.set(cacheKey, result);

      return res.json({
        status: state,
        answer: result,
      });
    }

    return res.json({
      status: state,
      message: state === 'failed' ? 'Processing failed' : 'Still processing',
    });
  } catch (err) {
    console.error('Error in status endpoint:', err);
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

    // Only allow authorized requests
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== process.env.AI_REFRESH_TOKEN) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // If Redis is not available, perform direct refresh
    if (!isRedisAvailable) {
      console.log('Performing direct vector store refresh (Redis unavailable)');
      try {
        // Close existing vector store connections
        await closeVectorStore();

        // Clear caches
        vectorStoreCache.del('vectorStore');
        queryCache.flushAll();
        clearRetrieverCache();

        // Reset the QA chain
        qaChain = null;

        // Reinitialize vector store
        const vs = await initVectorStore();
        vectorStoreCache.set('vectorStore', vs);

        // Recreate QA chain
        qaChain = createQAChain(vs);

        console.log('Vector store refresh completed successfully');
        return res.json({
          status: 'completed',
          message: 'Vector store refresh completed',
        });
      } catch (error) {
        console.error('Error during direct vector store refresh:', error);
        return res.status(500).json({
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
      }
    }

    // Start a background job to refresh the vector store
    const jobId = `refresh-${Date.now()}`;
    await aiQueue.add('refresh-vector-store', { jobId });

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
    const job = await aiQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
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
