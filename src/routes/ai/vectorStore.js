import { OpenAIEmbeddings } from '@langchain/openai';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';
import Meeting from '../../models/Meeting.js';
import Project from '../../models/Project.js';
import Record from '../../models/Table/Record.js';
import Table from '../../models/Table/Table.js';
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
    modelName: 'text-embedding-ada-002',
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
    loadProjectData(workspaceId, vectorStore, domainStores.projects),
    loadUserData(workspaceId, vectorStore, domainStores.users),
    loadMeetingData(workspaceId, vectorStore, domainStores.meetings),
    loadTableData(workspaceId, vectorStore, domainStores.tables),
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

// Helper function to load project data
async function loadProjectData(workspaceId, vectorStore, domainStore) {
  try {
    // Get pipeline settings for this workspace
    const pipelineSettings = await mongoose
      .model('PipelineSettings')
      .findOne({ workspace: workspaceId })
      .lean();

    // Create maps for fast lookup of stage and status details (by ID and by name)
    const stageByIdMap = new Map();
    const statusByIdMap = new Map();
    const stageByNameMap = new Map();
    const statusByNameMap = new Map();

    if (pipelineSettings) {
      pipelineSettings.stages?.forEach((stage) => {
        stageByIdMap.set(stage._id.toString(), stage);
        stageByNameMap.set(stage.name, stage);
      });

      pipelineSettings.statuses?.forEach((status) => {
        statusByIdMap.set(status._id.toString(), status);
        statusByNameMap.set(status.name, status);
      });
    }

    // Only load projects associated with this workspace
    const projects = await Project.find({ workspace: workspaceId })
      .populate('team.user manager createdBy')
      .lean();

    if (!projects || projects.length === 0) {
      console.log(`No project data found for workspace ${workspaceId}`);
      return;
    }

    console.log(`Loading ${projects.length} projects for workspace ${workspaceId}`);

    // Process in chunks of 50 for better memory management
    const CHUNK_SIZE = 50;
    for (let i = 0; i < projects.length; i += CHUNK_SIZE) {
      const chunk = projects.slice(i, i + CHUNK_SIZE);

      const projectDocs = chunk.map((project) => {
        // Check if status/stage are IDs or names and get the appropriate details
        let stageDetails, statusDetails;
        let stageName = project.stage;
        let statusName = project.status;

        // Handle status ID or name
        if (project.status && statusByIdMap.has(project.status)) {
          // It's an ID
          statusDetails = statusByIdMap.get(project.status);
          statusName = statusDetails.name;
        } else if (project.status && statusByNameMap.has(project.status)) {
          // It's a name
          statusDetails = statusByNameMap.get(project.status);
        } else {
          statusDetails = { name: project.status || 'Unknown', color: '#A0AEC0' };
        }

        // Handle stage ID or name
        if (project.stage && stageByIdMap.has(project.stage)) {
          // It's an ID
          stageDetails = stageByIdMap.get(project.stage);
          stageName = stageDetails.name;
        } else if (project.stage && stageByNameMap.has(project.stage)) {
          // It's a name
          stageDetails = stageByNameMap.get(project.stage);
        } else {
          stageDetails = { name: project.stage || 'Unknown', color: '#A0AEC0' };
        }

        return {
          pageContent: `
            Project: ${project.name}
            ID: ${project._id}
            Status: ${statusName} ${statusDetails.color ? `(${statusDetails.color})` : ''}
            Stage: ${stageName} ${stageDetails.color ? `(${stageDetails.color})` : ''}
            Description: ${project.description || 'No description'}
            Project Type: ${project.projectType || 'Not specified'}
            Manager: ${project.manager?.name || 'Unassigned'} (${project.manager?.email || ''})
            Lead Source: ${project.leadSource || 'Not specified'}
            Start Date: ${
              project.startDate ? new Date(project.startDate).toLocaleDateString() : 'Not set'
            }
            Target Date: ${
              project.targetDate ? new Date(project.targetDate).toLocaleDateString() : 'Not set'
            }
            Team Size: ${project.team?.length || 0}
            Created By: ${project.createdBy?.name || 'Unknown'}
            Created At: ${
              project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'Unknown'
            }
          `,
          metadata: {
            type: 'project',
            id: project._id.toString(),
            name: project.name,
            status: statusName,
            statusId: statusDetails._id?.toString(),
            statusColor: statusDetails.color,
            stage: stageName,
            stageId: stageDetails._id?.toString(),
            stageColor: stageDetails.color,
            workspaceId: workspaceId,
          },
        };
      });

      // Add to main vector store and domain-specific store
      await vectorStore.addDocuments(projectDocs);
      await domainStore.addDocuments(projectDocs);

      console.log(`Added ${projectDocs.length} project documents (chunk ${i / CHUNK_SIZE + 1})`);
    }
  } catch (error) {
    console.error('Error loading project data:', error);
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

// Helper function to load meeting data
async function loadMeetingData(workspaceId, vectorStore, domainStore) {
  try {
    // Only load meetings associated with this workspace
    const meetings = await Meeting.find({ workspace: workspaceId })
      .populate('participants.participant organizer')
      .lean();

    if (!meetings || meetings.length === 0) {
      console.log(`No meeting data found for workspace ${workspaceId}`);
      return;
    }

    console.log(`Loading ${meetings.length} meetings for workspace ${workspaceId}`);

    const meetingDocs = meetings.map((meeting) => ({
      pageContent: `
        Meeting: ${meeting.title}
        ID: ${meeting._id}
        Type: ${meeting.type}
        Date: ${meeting.date ? new Date(meeting.date).toLocaleDateString() : 'Not set'}
        Time: ${meeting.startTime || 'Not set'} - ${meeting.endTime || 'Not set'}
        Status: ${meeting.status}
        Description: ${meeting.description || 'No description'}
        Location: ${meeting.location || 'Not specified'}
        Organizer: ${meeting.organizer?.name || 'Unknown'}
        Participants: ${
          meeting.participants?.map((p) => p.participant?.name || 'Unknown').join(', ') || 'None'
        }
        Created At: ${
          meeting.createdAt ? new Date(meeting.createdAt).toLocaleDateString() : 'Unknown'
        }
      `,
      metadata: {
        type: 'meeting',
        id: meeting._id.toString(),
        title: meeting.title,
        date: meeting.date ? new Date(meeting.date).toISOString() : null,
        workspaceId: workspaceId,
      },
    }));

    // Add to main vector store and domain-specific store
    await vectorStore.addDocuments(meetingDocs);
    await domainStore.addDocuments(meetingDocs);

    console.log(`Added ${meetingDocs.length} meeting documents for workspace ${workspaceId}`);
  } catch (error) {
    console.error('Error loading meeting data:', error);
  }
}

// Helper function to load table data
async function loadTableData(workspaceId, vectorStore, domainStore) {
  try {
    // Only load tables for this workspace
    const tables = await Table.find({ workspace: workspaceId }).lean();

    if (!tables || tables.length === 0) {
      console.log(`No table data found for workspace ${workspaceId}`);
      return;
    }

    console.log(`Loading ${tables.length} tables for workspace ${workspaceId}`);

    // Process each table
    for (const table of tables) {
      console.log(`Processing table: ${table.name} (ID: ${table._id})`);

      try {
        // Find rows for this table
        const mongoose = await import('mongoose');
        const Row = mongoose.default.model('Row');

        // Get rows first
        const rows = await Row.find({ tableId: table._id }).lean();
        console.log(`Found ${rows.length} rows for table ${table.name}`);

        // Get rowIds
        const rowIds = rows.map((row) => row._id);

        // Fetch records for these rows
        const records = await Record.find({
          tableId: table._id,
          rowId: { $in: rowIds },
        }).lean();

        console.log(`Found ${records.length} records for table ${table.name}`);

        // Debug the first record
        if (records.length > 0) {
          console.log('DEBUG - First record:', JSON.stringify(records[0], null, 2));
        }

        // Build schema description
        const schemaDescription = `
          Table Name: ${table.name}
          ID: ${table._id}
          Description: ${table.description || 'No description'}
          Columns: ${table.columns?.map((c) => `${c.name} (${c.type})`).join(', ') || 'None'}
        `;

        // Include AI prompt guide if available
        const aiGuideSection = table.aiPromptGuide
          ? `\nAI Prompt Guide:\n${table.aiPromptGuide}\n`
          : '';

        // Group records by rowId for proper table structure
        const recordsByRow = {};

        // First organize records by row
        records.forEach((record) => {
          if (!record.rowId) return;

          const rowIdStr = record.rowId.toString();
          if (!recordsByRow[rowIdStr]) {
            recordsByRow[rowIdStr] = {};
          }

          // Store this record's value under the column ID
          if (record.columnId) {
            // Extract values - they could be in record.values or directly in the record
            let value;
            if (record.values && typeof record.values === 'object') {
              if (record.values instanceof Map || typeof record.values.get === 'function') {
                value = record.values.get(record.columnId);
              } else {
                // Regular object
                value = record.values[record.columnId];
              }
            } else {
              // Direct value
              value = record.value;
            }

            // Store the value
            recordsByRow[rowIdStr][record.columnId] = value;
          }
        });

        // Extract row data as an array
        const rowsData = Object.values(recordsByRow);
        console.log(`Organized into ${rowsData.length} complete rows`);

        // Create records description as markdown table
        let recordsDescription = '';
        if (rowsData.length > 0 && table.columns?.length > 0) {
          // Start building the markdown table
          recordsDescription = 'Sample Records (Table Format):\n\n';

          // Add header row with column names
          recordsDescription +=
            '| ' + table.columns.map((col) => col.name || 'Unnamed').join(' | ') + ' |\n';
          recordsDescription += '| ' + table.columns.map(() => '---').join(' | ') + ' |\n';

          // Add data rows (limit to 10)
          const rowsToShow = rowsData.slice(0, 10);
          rowsToShow.forEach((rowData) => {
            const rowValues = table.columns.map((col) => {
              const value = rowData[col.id];

              // Format value
              if (value === undefined || value === null) {
                return '';
              } else if (typeof value === 'object') {
                // For objects, just show a simple representation
                try {
                  return JSON.stringify(value);
                } catch (e) {
                  return '[Complex Object]';
                }
              }

              return String(value).substring(0, 50); // Truncate very long values
            });

            recordsDescription += '| ' + rowValues.join(' | ') + ' |\n';
          });

          recordsDescription += '\n';
        } else {
          // Fallback if no structured data
          recordsDescription = 'No data available for this table.\n';
        }

        // Create document
        const tableDoc = {
          pageContent: `${schemaDescription}${aiGuideSection}\n${recordsDescription}`,
          metadata: {
            type: 'table',
            id: table._id.toString(),
            name: table.name,
            workspaceId: workspaceId,
            hasAiGuide: !!table.aiPromptGuide,
          },
        };

        // Add to main vector store and domain-specific store
        await vectorStore.addDocuments([tableDoc]);
        await domainStore.addDocuments([tableDoc]);

        console.log('🚀 tableDoc:', tableDoc);
      } catch (tableError) {
        console.error(`Error processing table ${table.name}:`, tableError);
      }
    }
  } catch (error) {
    console.error('Error loading table data:', error);
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
