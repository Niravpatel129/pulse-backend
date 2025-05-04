# AI Caching System

This document explains how the AI caching system works in our application, particularly focusing on how updates to table aiPromptGuide updates work.

## Cache Layers

Our system has multiple cache layers:

1. **Vector Store Cache**: Stores the initialized vector stores for each workspace

   - Location: `vectorStoreCache` in `aiRoutes.js`
   - TTL: 1 hour
   - Purpose: Avoids expensive vector store initialization

2. **Workspace Vector Stores**: Maps workspace IDs to their vector stores and domain-specific stores

   - Location: `workspaceVectorStores` in `vectorStore.js`
   - No TTL (persists until cleared)
   - Purpose: Maintains in-memory reference to vector stores

3. **Query Cache**: Stores results of previous queries

   - Location: `retrievalCache` in `chain.js`
   - TTL: 5 minutes
   - Purpose: Avoids repeated retrieval for similar queries

4. **Reasoning Cache**: Stores analyzed queries and their intents

   - Location: `reasoningCache` in `chain.js`
   - TTL: 15 minutes
   - Purpose: Speeds up query analysis for repeated questions

5. **Settings Cache**: Stores workspace chat settings

   - Location: `settingsCache` in `chain.js`
   - TTL: 10 minutes
   - Purpose: Reduces database lookups for chat settings

6. **Conversation History Cache**: Stores chat history for each workspace session
   - Location: `conversationHistory` in `aiRoutes.js`
   - TTL: 30 minutes
   - Purpose: Maintains context for ongoing conversations

## Cache Invalidation on AI Prompt Guide Updates

When a user updates a table's `aiPromptGuide`, we follow these steps to ensure the AI gets the updated information:

1. **Detect Changes**:

   - We first check if the AI prompt guide has actually changed before proceeding

2. **Immediate Cache Clearing**:

   - We clear the retrieval cache for the workspace to ensure new queries don't get old results
   - This is done via `clearRetrieverCache(workspaceId)`

3. **Vector Store Refresh**:

   - We close the existing vector store connections via `closeVectorStore(workspaceId)`
   - We initialize a new vector store via `initVectorStore(workspaceId)`
   - This rebuilds all embeddings with the updated AI guide information

4. **Background Processing**:

   - The vector store refresh runs in the background to avoid blocking the API response
   - This allows the update to complete quickly while the refresh happens asynchronously

5. **Distributed Systems Support**:
   - In production, we also call the `/api/ai/refresh` endpoint as a backup mechanism
   - This supports scenarios where the AI service is running as a separate process/container

## When Caches Are Updated

| Type of Update | Caches Cleared                                                 |
| -------------- | -------------------------------------------------------------- |
| Table AI Guide | Vector Store Cache, Retrieval Cache, QA Chain                  |
| Chat Settings  | Settings Cache, QA Chain                                       |
| Workspace Data | Vector Store Cache, Retrieval Cache, QA Chain, Reasoning Cache |

## How AI Guides Are Used

When a user asks a question about tables, the system:

1. Identifies that the query relates to tables
2. Makes targeted retrievals for tables and their AI guides
3. Extracts the guides and adds them as a special section
4. Prioritizes information from these guides in the AI's response

This ensures that workspace-specific knowledge and rules about tables are properly respected in every AI interaction.

## Manual Cache Refresh

If needed, administrators can manually trigger a cache refresh by:

1. Calling the `/api/ai/refresh` endpoint with a valid token
2. Setting the refresh token in environment variables (`AI_REFRESH_TOKEN`)
3. Passing a specific `workspaceId` in the request body

Example:

```bash
curl -X POST https://your-api.com/api/ai/refresh \
  -H "Authorization: Bearer your-refresh-token" \
  -H "Content-Type: application/json" \
  -d '{"workspaceId": "workspace-id-here"}'
```
