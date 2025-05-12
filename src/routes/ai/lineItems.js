import { extractProductsFromPrompt } from './lineItemsUtils.js';

// Helper function to estimate query cost
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

export async function processLineItems(
  prompt,
  workspaceChain,
  workspaceId,
  userId,
  history = '',
  documentContext = '',
) {
  const startTime = Date.now();
  console.log('🚀 documentContext at lineItems.js:');

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
 
 
 ${documentContext}
 
 ${
   history
     ? `Previous conversation context:\n${history}\n\nUse this context to better understand the current request and maintain consistency with previously mentioned items.`
     : ''
 }
 
 Categorize each item as either PRODUCT or SERVICE based on the description.
 If an item is described as a service or is called/named something without physical attributes, treat it as a SERVICE.
 Products are physical items like clothing.
 
 Format your response EXACTLY like this:
 {"lineItems":[{"name":"Item Name","description":"Item Description","price":"XX.XX","type":"PRODUCT/SERVICE","qty":1,"discount":"0","taxName":"","taxRate":"0","reasoning":"Explanation of where the name, price, and description were derived from"}]}
 
 For pricing: Use the mentioned price or a reasonable estimate.
 For service items: If the price isn't mentioned, use 50.00 as default.
 For product items: Include relevant details like color in the name and description.
 Look for quantity information in the prompt (e.g., "2 shirts" or "quantity of 3"). If no quantity is specified, default to 1.
 For discounts: If a percentage discount is mentioned (e.g., "15% discount"), use just the number (e.g., "15"). If no discount mentioned, use "0".
 For tax: If "no tax" is mentioned, use empty string for taxName and "0" for taxRate. If specific tax is mentioned, use that name and rate.
 Make sure to include ALL items mentioned in the prompt.

 For the reasoning field, explain:
 1. Where you got the name from (extracted from prompt, database, or generated)
 2. How you determined the price (explicit in prompt, estimated, or default)
 3. How you created the description (based on product type, extracted from database, etc.)
 4. Where the quantity came from (explicit in prompt or default)
 5. Any discounts or tax information mentioned in the prompt
 6. How the conversation history influenced the item details (if applicable)
 
 Example correct format:
 {"lineItems":[{"name":"Red Hoodie","description":"Red cotton hoodie with front pocket","price":"19.99","type":"PRODUCT","qty":2,"discount":"15","taxName":"","taxRate":"0","reasoning":"Name derived from 'red hoodie' in prompt. Price estimated based on market value. Description generated based on standard hoodie features. Quantity of 2 extracted from prompt '2 red hoodies'. 15% discount applied as specified. No tax as mentioned in prompt."}]}
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
      price: item.price ? item.price.replace('$', '') : item.type === 'SERVICE' ? '50.00' : '19.99',
      type: item.type || 'PRODUCT',
      qty: item.qty || 1,
      discount: item.discount || '0',
      taxName: item.taxName || '',
      taxRate: item.taxRate || '0',
      reasoning:
        item.reasoning ||
        `Name, price, and description derived from AI analysis of the prompt: "${prompt}".`,
    }));

    // Estimate cost
    const responseText = JSON.stringify(lineItems);
    const costEstimate = estimateQueryCost(prompt, responseText);
    console.log(
      `💰 Line Items Generation Cost Estimate: $${costEstimate.totalCost.toFixed(6)}` +
        ` (Input: ~${costEstimate.inputTokens} tokens, Output: ~${
          costEstimate.outputTokens
        } tokens, Time: ${(endTime - startTime) / 1000}s)`,
    );

    // Return structured response
    return {
      lineItems,
      meta: {
        processingTime: (endTime - startTime) / 1000,
        promptLength: prompt.length,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Error with line items generation:', error);
    console.log('Falling back to manual extraction...');

    // Use the fallback extraction with improved service item detection
    const products = extractProductsFromPrompt(prompt);

    const endTime = Date.now();
    return {
      lineItems: products,
      meta: {
        processingTime: (endTime - startTime) / 1000,
        promptLength: prompt.length,
        timestamp: new Date().toISOString(),
        fallback: true,
        error: error.message,
      },
    };
  }
}
