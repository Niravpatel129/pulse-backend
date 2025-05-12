import { OpenAIEmbeddings } from '@langchain/openai';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';
import User from '../../models/User.js';
import Workspace from '../../models/Workspace.js';

dotenv.config();

// Store vectorStores by workspaceId
const workspaceVectorStores = new Map();

// Export for cache management in other modules
export { workspaceVectorStores };

// Domain-specific vector stores for better search performance
const createDomainStores = () => ({
  workspace: null,
  projects: null,
  users: null,
  leads: null,
  meetings: null,
  tables: null,
});

export async function initVectorStore(workspaceId) {
  if (!workspaceId) {
    throw new Error('workspaceId is required for vector store initialization');
  }

  console.log(`Initializing vector store for workspace: ${workspaceId}`);

  // Return cached vector store if already initialized for this workspace
  if (workspaceVectorStores.has(workspaceId)) {
    console.log('Using cached vector store for workspace');
    return workspaceVectorStores.get(workspaceId);
  }

  // 1️⃣ Connect MongoDB Driver with connection pooling for better scalability
  const mongoClient = new MongoClient(process.env.MONGO_URI, {
    maxPoolSize: 50,
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  await mongoClient.connect();
  console.log('Connected to MongoDB');

  const collection = mongoClient
    .db(process.env.DB_NAME)
    .collection(process.env.VECTOR_COLLECTION_NAME);

  // 2️⃣ Build the LangChain-backed Atlas vector store with optimized settings
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'text-embedding-3-small',
    stripNewLines: true,
    batchSize: 1000, // Increase batch size for better performance
    maxConcurrency: 5, // Limit concurrent API calls
  });

  // Use memory store for development or when MongoDB Atlas Vector Search is not available
  const { MemoryVectorStore } = await import('langchain/vectorstores/memory');

  // Create domain-specific vector stores for this workspace
  const domainStores = createDomainStores();

  for (const domain of Object.keys(domainStores)) {
    domainStores[domain] = new MemoryVectorStore(embeddings);
  }

  // Main vector store that can search across all domains for this workspace
  const vectorStore = new MemoryVectorStore(embeddings);

  // 3️⃣ Connect Mongoose with optimized connection settings
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.DB_NAME,
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 30000,
    });
    console.log('Connected to Mongoose');
  }

  // 4️⃣ Load data in parallel for better performance - filtered by workspaceId
  await Promise.all([
    loadWorkspaceData(workspaceId, vectorStore, domainStores.workspace),
    loadUserData(workspaceId, vectorStore, domainStores.users),
  ]);

  // Store workspace-specific stores
  workspaceVectorStores.set(workspaceId, {
    main: vectorStore,
    domains: domainStores,
    mongoClient,
  });

  console.log(`Vector store initialization complete for workspace: ${workspaceId}`);
  return { main: vectorStore, domains: domainStores };
}

// Helper function to load workspace data
async function loadWorkspaceData(workspaceId, vectorStore, domainStore) {
  try {
    // Load only the specific workspace
    const workspace = await Workspace.findById(workspaceId)
      .populate('members.user createdBy')
      .lean();

    if (!workspace) {
      console.log(`Workspace ${workspaceId} not found`);
      return;
    }

    console.log(`Loading workspace: ${workspace.name}`);

    const summary = `
      Workspace: ${workspace.name || 'Unnamed'}
      ID: ${workspace._id}
      Description: ${workspace.description || 'No description available'}
      Created by: ${workspace.createdBy?.name || 'Unknown'}
      Member count: ${workspace.members?.length || 0}
      Created at: ${
        workspace.createdAt ? new Date(workspace.createdAt).toLocaleDateString() : 'Unknown'
      }
    `;

    const workspaceSummary = {
      pageContent: summary,
      metadata: {
        type: 'workspace',
        id: workspace._id.toString(),
        name: workspace.name,
      },
    };

    // Add to main vector store and domain-specific store
    await vectorStore.addDocuments([workspaceSummary]);
    await domainStore.addDocuments([workspaceSummary]);

    console.log(`Added workspace summary to vector stores for ${workspace.name}`);
  } catch (error) {
    console.error('Error loading workspace data:', error);
  }
}

// Helper function to load user data
async function loadUserData(workspaceId, vectorStore, domainStore) {
  try {
    // Find the workspace to get member users
    const workspace = await Workspace.findById(workspaceId).lean();

    if (!workspace || !workspace.members || workspace.members.length === 0) {
      console.log(`No members found for workspace ${workspaceId}`);
      return;
    }

    // Get user IDs from workspace members
    const memberUserIds = workspace.members.map((member) => member.user);

    // Only load users who are members of this workspace
    const users = await User.find({
      _id: { $in: memberUserIds },
    })
      .select('-password')
      .lean();

    if (!users || users.length === 0) {
      console.log(`No user data found for workspace ${workspaceId}`);
      return;
    }

    console.log(`Loading ${users.length} users for workspace ${workspaceId}`);

    const userDocs = users.map((user) => ({
      pageContent: `
        User: ${user.name}
        ID: ${user._id}
        Email: ${user.email}
        Role: ${user.role}
        Job Title: ${user.jobTitle || 'Not specified'}
        Bio: ${user.bio || 'No bio available'}
        Created At: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
      `,
      metadata: {
        type: 'user',
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        workspaceId: workspaceId,
      },
    }));

    // Add to main vector store and domain-specific store
    await vectorStore.addDocuments(userDocs);
    await domainStore.addDocuments(userDocs);

    console.log(`Added ${userDocs.length} user documents for workspace ${workspaceId}`);
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}

// Get domain-specific vector store for more focused searches
export function getDomainVectorStore(workspaceId, domain) {
  const workspaceStore = workspaceVectorStores.get(workspaceId);

  if (!workspaceStore) {
    console.warn(`Vector store for workspace '${workspaceId}' not found`);
    return null;
  }

  if (!workspaceStore.domains[domain]) {
    console.warn(
      `Domain vector store for '${domain}' not found in workspace ${workspaceId}, using main vector store`,
    );
    return workspaceStore.main;
  }

  return workspaceStore.domains[domain];
}

// Clean up function to close connections when shutting down
export async function closeVectorStore(workspaceId) {
  if (workspaceId) {
    // Close specific workspace vector store
    const workspaceStore = workspaceVectorStores.get(workspaceId);
    if (workspaceStore) {
      if (workspaceStore.mongoClient) {
        await workspaceStore.mongoClient.close();
      }
      workspaceVectorStores.delete(workspaceId);
      console.log(`Vector store for workspace ${workspaceId} closed and cleared`);
    }
  } else {
    // Close all vector stores
    for (const [id, store] of workspaceVectorStores.entries()) {
      if (store.mongoClient) {
        await store.mongoClient.close();
      }
    }

    workspaceVectorStores.clear();
    console.log('All vector stores cleared');
  }

  // Only disconnect mongoose if this was the last workspace
  if (workspaceVectorStores.size === 0 && mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('Mongoose connection closed');
  }
}

// For backward compatibility
export function clearRetrieverCache(workspaceId) {
  // Clear any retriever caches specific to this workspace
  console.log(`Clearing retriever cache for workspace ${workspaceId}`);
}
