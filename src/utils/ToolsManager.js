import { OpenAIEmbeddings } from '@langchain/openai';
import NodeCache from 'node-cache';
import WorkspaceEmbedding from '../models/WorkspaceEmbedding.js';

class ToolsManager {
  constructor(workspaceId) {
    this.workspaceId = workspaceId;
    this.embeddingsCache = new NodeCache({ stdTTL: 3600 }); // Cache embeddings for 1 hour
    this.tools = [
      {
        type: 'function',
        function: {
          name: 'search_workspace',
          description: 'Search through workspace embeddings for relevant information',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query to find relevant workspace content',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 3)',
              },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_pricing',
          description: 'Get pricing information for a specific part number',
          parameters: {
            type: 'object',
            properties: {
              partNumber: {
                type: 'string',
                description: 'The part number to get pricing information for',
              },
            },
            required: ['partNumber'],
          },
        },
      },
    ];
  }

  getTools() {
    return this.tools;
  }

  async executeTool(toolCall, toolCallArgs) {
    try {
      // Validate tool call
      if (!toolCall || !toolCall.function || !toolCall.function.name) {
        throw new Error('Invalid tool call format');
      }

      // Validate arguments
      if (!toolCallArgs || (typeof toolCallArgs === 'string' && !toolCallArgs.trim())) {
        throw new Error(`Missing required arguments for tool: ${toolCall.function.name}`);
      }

      // Parse arguments if they're a string
      const args = typeof toolCallArgs === 'string' ? JSON.parse(toolCallArgs) : toolCallArgs;

      switch (toolCall.function.name) {
        case 'search_workspace':
          if (!args.query) {
            throw new Error('Query parameter is required for workspace search');
          }
          return await this.executeSearchWorkspace(args.query, args.limit || 3);
        case 'get_pricing':
          // Handle array of part numbers
          if (Array.isArray(args)) {
            // Process sequentially to avoid overwhelming the system
            const results = [];
            for (const arg of args) {
              try {
                if (!arg.partNumber) {
                  results.push({
                    partNumber: 'unknown',
                    status: 'error',
                    message: 'Part number is required for pricing lookup',
                  });
                  continue;
                }
                const result = await this.executeGetPricing(arg.partNumber);
                results.push(result);
              } catch (error) {
                results.push({
                  partNumber: arg.partNumber,
                  status: 'error',
                  message: `Failed to get pricing: ${error.message}`,
                });
              }
            }
            return results;
          }
          // Single part number case
          if (!args.partNumber) {
            throw new Error('Part number is required for pricing lookup');
          }
          return await this.executeGetPricing(args.partNumber);
        default:
          throw new Error(`Unknown tool: ${toolCall.function.name}`);
      }
    } catch (error) {
      console.error('Error executing tool:', {
        tool: toolCall?.function?.name,
        error: error.message,
        args: toolCallArgs,
      });
      throw new Error(`Error executing tool: ${error.message}`);
    }
  }

  async executeSearchWorkspace(query, limit) {
    if (!query || typeof query !== 'string') {
      throw new Error(`Invalid search query format. Received: ${JSON.stringify(query)}`);
    }

    if (!this.workspaceId) {
      throw new Error('Workspace ID is required for workspace search');
    }

    try {
      // Create embeddings instance for query
      const embeddingsModel = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
      });

      // Get query embedding (with caching)
      let queryEmbedding = this.embeddingsCache.get(query);
      if (!queryEmbedding) {
        queryEmbedding = await embeddingsModel.embedQuery(query);
        this.embeddingsCache.set(query, queryEmbedding);
      }

      // Try to get cached results first
      const cacheKey = `workspace_search_${this.workspaceId}_${query}`;
      const cachedResults = this.embeddingsCache.get(cacheKey);
      if (cachedResults) {
        return cachedResults;
      }

      // Get workspace embeddings from the database with pagination and timeout
      const embeddings = await WorkspaceEmbedding.find({
        workspace: this.workspaceId,
        status: 'active',
      })
        .select('title description metadata embedding')
        .lean()
        .maxTimeMS(5000); // 5 second timeout

      if (!embeddings.length) {
        return 'No workspace embeddings found to search through.';
      }

      // Calculate similarity scores in batches to avoid memory issues
      const batchSize = 50;
      const results = [];

      for (let i = 0; i < embeddings.length; i += batchSize) {
        const batch = embeddings.slice(i, i + batchSize);
        try {
          const batchResults = batch.map((doc) => ({
            title: doc.title,
            description: doc.description,
            metadata: doc.metadata,
            similarity: this.cosineSimilarity(queryEmbedding, doc.embedding),
          }));
          results.push(...batchResults);
        } catch (error) {
          console.error(`Error processing batch ${i / batchSize + 1}:`, error);
          continue; // Skip problematic batch and continue with others
        }
      }

      if (results.length === 0) {
        return 'Error processing workspace content. Please try again.';
      }

      // Sort by similarity and get top results
      const topResults = results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);

      if (topResults.length === 0) {
        return 'No relevant workspace content found.';
      }

      // Format results
      const formattedResults = topResults.map((result) => ({
        title: result.title,
        description: result.description,
        metadata: result.metadata,
        relevance: Math.round(result.similarity * 100) + '%',
      }));

      // Cache the results for 5 minutes
      this.embeddingsCache.set(cacheKey, formattedResults, 300);

      return formattedResults;
    } catch (error) {
      console.error('Error searching workspace embeddings:', error);
      if (error.name === 'MongooseError' && error.message.includes('timed out')) {
        return 'Search timed out. Please try again with a more specific query.';
      }
      throw new Error(`Failed to search workspace: ${error.message}`);
    }
  }

  async executeGetPricing(partNumber) {
    if (!partNumber || typeof partNumber !== 'string') {
      throw new Error(`Invalid part number format. Received: ${JSON.stringify(partNumber)}`);
    }

    try {
      // Add timeout to the workspace search
      const searchPromise = this.executeSearchWorkspace(partNumber, 1);
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error('Search timed out')), 10000), // 10 second timeout
      );

      // Race between search and timeout
      const searchResults = await Promise.race([searchPromise, timeoutPromise]);

      if (!searchResults || searchResults.length === 0) {
        return {
          partNumber,
          status: 'not_found',
          message: `No product found with part number: ${partNumber}`,
        };
      }

      // Here you would typically integrate with your pricing system
      // For now, returning a mock response with the product details
      const product = searchResults[0];
      return {
        partNumber,
        status: 'success',
        title: product.title,
        description: product.description,
        metadata: product.metadata,
        pricing: {
          currency: 'USD',
          price: 'Contact for pricing',
          availability: 'In stock',
        },
      };
    } catch (error) {
      console.error('Error getting pricing:', {
        partNumber,
        error: error.message,
        stack: error.stack,
      });

      if (error.message === 'Search timed out') {
        return {
          partNumber,
          status: 'timeout',
          message: 'Search timed out. Please try again with a more specific query.',
        };
      }

      return {
        partNumber,
        status: 'error',
        message: `Failed to get pricing: ${error.message}`,
      };
    }
  }

  cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  createToolResponse(toolCall, content) {
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      name: toolCall.function.name,
      content: content,
    };
  }

  createToolCallMessage(toolCall) {
    return {
      role: 'assistant',
      content: null,
      tool_calls: [toolCall],
    };
  }
}

export default ToolsManager;
