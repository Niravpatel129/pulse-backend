import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔍 Testing Google Business Analysis API...');
console.log('Environment check:');
console.log('- SERPAPI_KEY:', process.env.SERPAPI_KEY ? '✅ SET' : '❌ NOT SET');
console.log(
  '- GOOGLE_PLACES_API_KEY:',
  process.env.GOOGLE_PLACES_API_KEY ? '✅ SET' : '❌ NOT SET',
);
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ SET' : '❌ NOT SET');

const testData = {
  business_name: "Joe's Pizza",
  location: 'New York, NY',
  keywords: ['pizza'],
  industry: 'restaurant',
};

console.log('\n🚀 Making API request...');
console.log('Request data:', JSON.stringify(testData, null, 2));

try {
  const response = await axios.post(
    'http://localhost:5000/api/business-analysis/analyze-google-business',
    testData,
    {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    },
  );

  console.log('\n✅ API Response Status:', response.status);
  console.log('Response data:', JSON.stringify(response.data, null, 2));
} catch (error) {
  console.error('\n❌ API Request failed:');
  console.error('Error message:', error.message);
  if (error.response) {
    console.error('Response status:', error.response.status);
    console.error('Response data:', JSON.stringify(error.response.data, null, 2));
  }
}
