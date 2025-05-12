import { MongoDBAtlasVectorSearch } from '@langchain/mongodb';
import { OpenAIEmbeddings } from '@langchain/openai';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import { processLineItems } from './lineItems.js';
dotenv.config();

// Initialize MongoDB client
const mongoClient = new MongoClient(process.env.MONGO_URI);

// Connect to MongoDB
await mongoClient.connect();

// Helper function to validate ObjectId
function isValidObjectId(id) {
  try {
    return ObjectId.isValid(id) && new ObjectId(id).toString() === id.toString();
  } catch (error) {
    return false;
  }
}

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
  const hasPrice = reasoning.toLowerCase().includes('price');
  const hasQuantity = reasoning.toLowerCase().includes('quantity');
  const hasColor = reasoning.toLowerCase().includes('color');
  const hasType = reasoning.toLowerCase().includes('type');
  const isModification =
    reasoning.toLowerCase().includes('modif') || reasoning.toLowerCase().includes('change');
  const isNewItem =
    reasoning.toLowerCase().includes('new') || reasoning.toLowerCase().includes('additional');

  // Build a natural message based on what was found
  let message = '';

  if (isModification) {
    message = "I've updated the item";
    if (hasColor) message += ' with the new color';
    if (hasPrice) message += ' and adjusted the price';
    if (hasQuantity) message += ' with the new quantity';
  } else if (isNewItem) {
    message = "I've added the new item";
    if (hasColor) message += ' in the requested color';
    if (hasPrice) message += ' at the specified price';
    if (hasQuantity) message += ' with the requested quantity';
  } else {
    message = "I've processed your request";
    if (hasColor) message += ' for the specified color';
    if (hasPrice) message += ' at the given price';
    if (hasQuantity) message += ' with the requested quantity';
  }

  // Add a helpful context about what was done
  if (hasType) {
    message += `. The item has been categorized as a ${
      reasoning.match(/type\s*[":]\s*([^,\.]+)/i)?.[1] || 'product'
    }`;
  }

  message += '. Here are the details:';

  return message;
}

export async function processSmartResponse(
  prompt,
  workspaceChain,
  workspaceId,
  userId,
  history = '',
) {
  const startTime = Date.now();

  // Validate workspaceId
  if (!workspaceId || !isValidObjectId(workspaceId)) {
    throw new Error('Invalid workspace ID provided');
  }

  try {
    // Initialize embeddings for document search
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-ada-002',
      stripNewLines: true,
    });

    // Create vector store instance using the existing vector_index
    const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
      collection: mongoClient.db().collection('document_vectors'),
      indexName: 'vector_index',
      embeddingField: 'embedding',
      textField: 'text',
      filter: {
        workspaceId: new ObjectId(String(workspaceId)),
      },
    });

    // Search for relevant document chunks
    const relevantDocs = await vectorStore.similaritySearch(prompt, 10);

    const documentContext =
      relevantDocs.length > 0
        ? `\nThe following is context from your workspace documents.\nUse the information if relevant to the user's request.\n\n--- DOCUMENT CONTEXT START ---\n${relevantDocs
            .map((doc) => doc.pageContent)
            .join('\n\n---\n\n')}\n--- DOCUMENT CONTEXT END ---\n`
        : '';

    // First, analyze the prompt to determine if it's a line item request
    const analysisPrompt = `
Use ONLY the information in the document context below to answer the user's request. If the answer is not present, say so.

Analyze this user request and determine if it's asking for line items, client information, or a general response.
A line item request typically:
- Mentions specific products or services
- Includes quantities, prices, or descriptions
- Asks for itemized lists or breakdowns
- Contains words like "add", "include", "list", "items", "products", "services"
- Modifies or refers to previously mentioned items (e.g., "make it blue" when a shirt was previously mentioned)

A client information request typically:
- Mentions "new client", "building invoice", "client details"
- Contains company names, contact information, addresses
- Includes email addresses, phone numbers, or physical addresses
- References business or client-related information
- Specifically asks for client-specific information like account numbers, tax IDs, or client identifiers

A general response request typically:
- Asks for information or explanations
- Seeks advice or recommendations
- Requests clarification or details
- Contains questions or statements about general topics
- Is completely new and unrelated to previous items
- Asks about identifying or validating numbers, codes, or identifiers
- Requests information about what a specific number or code represents
- Asks for number format validation or explanation

$${
      history
        ? `Previous conversation context:\n${history}\n\nUse this context to understand if the current request is modifying or referring to previously mentioned items.`
        : ''
    }${documentContext}

User request: "${prompt}"

Respond with a JSON object in this exact format:
{
  "type": "LINE_ITEMS" or "CLIENT_INFO" or "GENERAL_RESPONSE",
  "confidence": number between 0 and 1,
  "reasoning": "Explanation of why this type was chosen, including how the conversation history and document context influenced the decision"
}
`;

    // Get the analysis result
    const analysisResult = await workspaceChain.invoke({
      query: analysisPrompt,
      workspaceId,
      userId,
      response_format: { type: 'json_object' },
      temperature: 0.5,
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
    console.log('🚀 type:', type);

    // If it's a line items request with high confidence, process it as line items
    if (type === 'LINE_ITEMS' && confidence >= 0.7) {
      console.log('Processing as line items request:', reasoning);
      const lineItemsResult = await processLineItems(
        prompt,
        workspaceChain,
        workspaceId,
        userId,
        history,
        documentContext,
      );

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

    // If it's a client information request with high confidence, process it as client information
    if (type === 'CLIENT_INFO' && confidence >= 0.7) {
      const clientPrompt = `
${documentContext}
You are an intelligent assistant helping to process client information for invoices. When the user requests placeholder or random information, generate realistic and appropriate data that makes sense in context.

IMPORTANT: First, check the document context below for any existing client information that matches the request. If found, use that information. Only generate new data if no matching information is found in the context.

IMPORTANT: Respond with ONLY a valid JSON object. Do not include any markdown formatting, backticks, or additional text.

For example:
- If asked for a "random location", generate a realistic address in the specified country
- If asked for "any number", generate a realistic number in the expected format
- If information seems incomplete or unclear, make reasonable assumptions based on context
- Always maintain consistency in the generated data (e.g., if generating a Canadian address, use proper Canadian postal code format)

User request: "${prompt}"

Return ONLY a JSON object in this exact format (no markdown, no backticks):
{
  "client": {
    "user": "Company name",
    "contact": "Email address",
    "phone": "Phone number",
    "address": "Primary address",
    "shippingAddress": "Shipping address if different",
    "taxId": "Tax ID number",
    "accountNumber": "Account number",
    "fax": "",
    "mobile": "",
    "tollFree": "",
    "website": "",
    "internalNotes": "Any relevant notes about the client",
    "customFields": {}
  },
  "suggestions": [
    "List of suggestions for additional information or improvements"
  ],
  "message": "A natural language response explaining what was done and any suggestions",
  "assumptions": [
    "List any assumptions made while processing the request"
  ],
  "source": "DOCUMENT_CONTEXT" or "GENERATED"
}

Guidelines for generating data:
1. Addresses should be realistic and follow proper formatting for the country
2. Phone numbers should match the country's format
3. Tax IDs and account numbers should follow expected patterns
4. When generating random data, ensure it's consistent with the client's context
5. If the user asks for something random, generate something that makes sense for a business
6. If multiple phone numbers are provided, use the most appropriate one as primary and others as mobile/fax
7. If client information is found in the document context, use it directly and indicate this in the source field
`;

      const clientResult = await workspaceChain.invoke({
        query: clientPrompt,
        workspaceId,
        userId,
        response_format: { type: 'json_object' },
        temperature: 0.8,
      });

      let parsedClientResponse;
      if (typeof clientResult === 'string') {
        try {
          // Clean the response string to ensure it's valid JSON
          const cleanedResponse = clientResult.replace(/```json\s*|\s*```/g, '').trim();
          parsedClientResponse = JSON.parse(cleanedResponse);
        } catch (error) {
          console.error('Error parsing client response:', error);
          throw new Error('Invalid client response format');
        }
      } else {
        parsedClientResponse = clientResult;
      }

      const endTime = Date.now();
      return {
        type: 'CHAT_RESPONSE',
        confidence,
        reasoning,
        message: parsedClientResponse.message,
        structuredData: [
          {
            type: 'INVOICE_CLIENT',
            client: parsedClientResponse.client,
            suggestions: parsedClientResponse.suggestions,
            assumptions: parsedClientResponse.assumptions,
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
${documentContext}
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
      temperature: 0.8,
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
