import dotenv from 'dotenv';
import { createQAChain } from './src/routes/ai/chain.js';
import { initVectorStore } from './src/routes/ai/vectorStore.js';

dotenv.config();

async function testChain() {
  try {
    console.log('Initializing vector store...');
    const vectorStore = await initVectorStore();

    console.log('Creating QA chain...');
    const qaChain = createQAChain(vectorStore);

    console.log('QA chain created:', !!qaChain);
    console.log('QA chain type:', typeof qaChain);

    // Print all available methods and properties
    console.log('QA chain methods/properties:', Object.getOwnPropertyNames(qaChain));
    console.log('QA chain invoke method type:', typeof qaChain.invoke);

    if (typeof qaChain.invoke !== 'function') {
      console.error('Error: qaChain.invoke is not a function');
      console.log('Available methods on qaChain:');
      for (const prop in qaChain) {
        console.log(`- ${prop}: ${typeof qaChain[prop]}`);
      }

      // Try other potential methods
      if (typeof qaChain.run === 'function') {
        console.log('Found .run() method, trying that instead...');
        const result = await qaChain.run({ query: 'What tables are available?' });
        console.log('Result from run():', result);
      } else if (typeof qaChain.pipe === 'function') {
        console.log('Found .pipe() method, this might be a RunnableSequence...');
      }

      return;
    }

    // Prepare the query and inspect it
    const query = 'What tables are available?';
    console.log('Query type:', typeof query);
    console.log('Query value:', query);

    // Test the chain with a simple question
    console.log('Testing chain with query...');
    const result = await qaChain.invoke({ query }); // Using query directly from variable

    console.log('Result type:', typeof result);
    console.log('Result structure:', Object.keys(result));
    console.log('Result:', result);
  } catch (error) {
    console.error('Error testing QA chain:', error);
    console.error('Error stack:', error.stack);
  }
}

testChain().then(() => console.log('Test complete'));
