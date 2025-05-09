import { processLineItems } from './lineItems.js';

// Helper function to estimate query cost
function estimateQueryCost(query, response) {
  const inputTokenEstimate = query.length / 4;
  const outputTokenEstimate = response.length / 4;
  const inputCostPerToken = 0.00001;
  const outputCostPerToken = 0.00002;
  const inputCost = inputTokenEstimate * inputCostPerToken;
  const outputCost = outputTokenEstimate * outputCostPerToken;
  const totalCost = inputCost + outputCost;

  return {
    inputTokens: Math.round(inputTokenEstimate),
    outputTokens: Math.round(outputTokenEstimate),
    totalCost,
  };
}

// Helper function to create a natural message from reasoning
function createNaturalMessage(reasoning) {
  // Extract key information from reasoning
  const hasPrice = reasoning.includes('price');
  const hasQuantity = reasoning.includes('quantity');
  const hasColor = reasoning.includes('color');
  const hasType = reasoning.includes('type');

  // Build a natural message based on what was found
  let message = "I've processed your request";

  if (hasPrice || hasQuantity || hasColor || hasType) {
    message += ' for the specified item';
    if (hasPrice) message += ' with the given price';
    if (hasQuantity) message += ' and quantity';
  }

  message += '. Here are the details:';

  return message;
}

export async function processSmartResponse(prompt, workspaceChain, workspaceId, userId) {
  const startTime = Date.now();

  // First, analyze the prompt to determine if it's a line item request
  const analysisPrompt = `
Analyze this user request and determine if it's asking for line items or a general response.
A line item request typically:
- Mentions specific products or services
- Includes quantities, prices, or descriptions
- Asks for itemized lists or breakdowns
- Contains words like "add", "include", "list", "items", "products", "services"

A general response request typically:
- Asks for information or explanations
- Seeks advice or recommendations
- Requests clarification or details
- Contains questions or statements about general topics

User request: "${prompt}"

Respond with a JSON object in this exact format:
{
  "type": "LINE_ITEMS" or "GENERAL_RESPONSE",
  "confidence": number between 0 and 1,
  "reasoning": "Explanation of why this type was chosen"
}
`;

  try {
    // Get the analysis result
    const analysisResult = await workspaceChain.invoke({
      query: analysisPrompt,
      workspaceId,
      userId,
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    let parsedAnalysis;
    if (typeof analysisResult === 'string') {
      try {
        parsedAnalysis = JSON.parse(analysisResult);
      } catch (error) {
        console.error('Error parsing analysis result:', error);
        throw new Error('Invalid analysis result format');
      }
    } else {
      parsedAnalysis = analysisResult;
    }

    const { type, confidence, reasoning } = parsedAnalysis;

    // If it's a line items request with high confidence, process it as line items
    if (type === 'LINE_ITEMS' && confidence >= 0.7) {
      console.log('Processing as line items request:', reasoning);
      const lineItemsResult = await processLineItems(prompt, workspaceChain, workspaceId, userId);

      const endTime = Date.now();
      return {
        type: 'CHAT_RESPONSE',
        confidence,
        reasoning,
        message: createNaturalMessage(reasoning),
        structuredData: [
          {
            type: 'LINE_ITEMS',
            items: lineItemsResult.lineItems,
          },
        ],
        meta: {
          processingTime: (endTime - startTime) / 1000,
          promptLength: prompt.length,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Otherwise, process as a general response
    console.log('Processing as general response:', reasoning);
    const generalPrompt = `
Provide a conversational response to this request: "${prompt}"

Your response should:
1. Be conversational and friendly
2. Address all aspects of the request
3. Provide relevant details and context
4. Be well-structured and easy to understand
5. Include specific examples or recommendations when appropriate

Format your response as a JSON object with this structure:
{
  "message": "Your conversational response here",
  "hasStructuredData": boolean,  // Only true if there's structured data to include
  "structuredData": [
    {
      "type": "GENERAL",
      "summary": "A brief 1-2 sentence summary",
      "keyPoints": ["Point 1", "Point 2", "Point 3"],
      "recommendations": ["Recommendation 1", "Recommendation 2"],
      "additionalContext": "Any relevant context or background information"
    }
  ]
}
`;

    const generalResult = await workspaceChain.invoke({
      query: generalPrompt,
      workspaceId,
      userId,
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    let parsedResponse;
    if (typeof generalResult === 'string') {
      try {
        parsedResponse = JSON.parse(generalResult);
      } catch (error) {
        // If parsing fails, use the raw response without structured data
        parsedResponse = {
          message: generalResult,
          hasStructuredData: false,
        };
      }
    } else {
      parsedResponse = generalResult;
    }

    const endTime = Date.now();
    const responseText = JSON.stringify(parsedResponse);
    const costEstimate = estimateQueryCost(prompt, responseText);

    console.log(
      `💰 Smart Response Cost Estimate: $${costEstimate.totalCost.toFixed(6)}` +
        ` (Input: ~${costEstimate.inputTokens} tokens, Output: ~${
          costEstimate.outputTokens
        } tokens, Time: ${(endTime - startTime) / 1000}s)`,
    );

    // Only include structuredData if hasStructuredData is true
    const response = {
      type: 'CHAT_RESPONSE',
      confidence,
      reasoning,
      message: parsedResponse.message,
      meta: {
        processingTime: (endTime - startTime) / 1000,
        promptLength: prompt.length,
        timestamp: new Date().toISOString(),
      },
    };

    if (parsedResponse.hasStructuredData && parsedResponse.structuredData) {
      response.structuredData = Array.isArray(parsedResponse.structuredData)
        ? parsedResponse.structuredData
        : [parsedResponse.structuredData];
    }

    return response;
  } catch (error) {
    console.error('Error in smart response processing:', error);

    // Fallback to general response with error handling
    const endTime = Date.now();
    return {
      type: 'CHAT_RESPONSE',
      confidence: 0.5,
      reasoning: 'Fallback to general response due to processing error',
      message:
        'I apologize, but I encountered an error processing your request. Could you please rephrase or provide more details?',
      meta: {
        processingTime: (endTime - startTime) / 1000,
        promptLength: prompt.length,
        timestamp: new Date().toISOString(),
        error: error.message,
      },
    };
  }
}
