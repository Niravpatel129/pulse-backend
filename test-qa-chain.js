const { createVectorStore } = require('./src/routes/ai/vectorStore');
const { createQAChain } = require('./src/routes/ai/chain');
require('dotenv').config();

async function testQAChain() {
  try {
    console.log('Initializing vector store...');
    const vectorStore = await createVectorStore();
    console.log('Vector store initialized.');

    console.log('Creating QA chain...');
    const qaChain = createQAChain(vectorStore);
    console.log('QA chain created, has invoke:', typeof qaChain.invoke === 'function');

    console.log('Testing query...');
    const result = await qaChain.invoke({ query: 'What tables are available?' });
    console.log('Query result:', result);
  } catch (error) {
    console.error('Error testing QA chain:', error);
  }
}

testQAChain().then(() => console.log('Test completed'));
