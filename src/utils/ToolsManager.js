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
          name: 'search_web',
          description: 'Search the web for current information about a topic',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query to look up on the web',
              },
            },
            required: ['query'],
          },
        },
      },
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
    ];
  }

  getTools() {
    return this.tools;
  }

  async executeTool(toolCall, toolCallArgs) {
    try {
      const args = JSON.parse(toolCallArgs);

      switch (toolCall.function.name) {
        case 'search_web':
          // OpenAI handles web search natively through function calling
          return `Searching the web for: ${args.query}`;
        case 'search_workspace':
          return await this.executeSearchWorkspace(args.query, args.limit || 3);
        default:
          throw new Error(`Unknown tool: ${toolCall.function.name}`);
      }
    } catch (error) {
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

      // Get workspace embeddings from the database with pagination
      const embeddings = await WorkspaceEmbedding.find({
        workspace: this.workspaceId,
        status: 'active',
      })
        .select('title description metadata embedding')
        .lean();

      if (!embeddings.length) {
        return 'No workspace embeddings found to search through.';
      }

      // Calculate similarity scores in batches to avoid memory issues
      const batchSize = 50;
      const results = [];

      for (let i = 0; i < embeddings.length; i += batchSize) {
        const batch = embeddings.slice(i, i + batchSize);
        const batchResults = batch.map((doc) => ({
          title: doc.title,
          description: doc.description,
          metadata: doc.metadata,
          similarity: this.cosineSimilarity(queryEmbedding, doc.embedding),
        }));
        results.push(...batchResults);
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
      throw new Error(`Failed to search workspace: ${error.message}`);
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
