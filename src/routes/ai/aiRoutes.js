import express from 'express';
import { createQAChain } from './chain.js';
import { initVectorStore } from './vectorStore.js';

const router = express.Router();
let qaChain;

router.post('/chat', async (req, res) => {
  try {
    console.log('Received chat request');
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Missing `message` in request body.' });
    }

    // Initialize & index on first call
    if (!qaChain) {
      console.log('Initializing vector store and QA chain...');
      const vs = await initVectorStore();

      console.log('Creating QA chain...');
      qaChain = createQAChain(vs);

      console.log('QA chain initialized:', !!qaChain);
      console.log('QA chain invoke method type:', typeof qaChain.invoke);
    }

    // Validate that qaChain has an invoke method
    if (!qaChain || typeof qaChain.invoke !== 'function') {
      throw new Error('QA chain not properly initialized, invoke method not available');
    }

    // 1️⃣ Retrieve & answer
    console.log(`Processing query: "${message}"`);
    const result = await qaChain.invoke({ query: message });
    console.log('Successfully generated answer:', result);

    // Check different result structures
    let answer = '';
    if (result && result.answer) {
      answer = result.answer;
    } else if (result && result.text) {
      answer = result.text;
    } else if (result && result.response) {
      answer = result.response;
    } else if (result && result.output) {
      answer = result.output;
    } else if (result && typeof result === 'object') {
      answer = JSON.stringify(result);
    } else {
      answer = String(result);
    }

    return res.json({ answer });
  } catch (err) {
    console.error('Error in /chat endpoint:', err);
    return res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

export default router;
