import { OpenAIEmbeddings } from '@langchain/openai';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';
import LeadForm from '../../models/LeadForm.js';
import Submission from '../../models/LeadForm/SubmissionSchema.js';
import Meeting from '../../models/Meeting.js';
import Project from '../../models/Project.js';
import Record from '../../models/Table/Record.js';
import Table from '../../models/Table/Table.js';
import User from '../../models/User.js';
import Workspace from '../../models/Workspace.js';

dotenv.config();

// Store vectorStores by workspaceId
const workspaceVectorStores = new Map();

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
    loadLeadData(workspaceId, vectorStore, domainStores.leads),
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

// Helper function to load lead data
async function loadLeadData(workspaceId, vectorStore, domainStore) {
  try {
    // Only load lead forms for this workspace
    const leadForms = await LeadForm.find({ workspace: workspaceId }).lean();

    if (!leadForms || leadForms.length === 0) {
      console.log(`No lead forms found for workspace ${workspaceId}`);
      return;
    }

    // Get form IDs to filter submissions
    const formIds = leadForms.map((form) => form._id);

    // Only get submissions for forms in this workspace
    const leadSubmissions = await Submission.find({
      formId: { $in: formIds },
    })
      .limit(200)
      .lean();

    console.log(
      `Loading ${leadForms.length} lead forms and ${leadSubmissions.length} submissions for workspace ${workspaceId}`,
    );

    const leadFormDocs = leadForms.map((form) => ({
      pageContent: `
        Lead Form: ${form.title}
        ID: ${form._id}
        Description: ${form.description || 'No description'}
        Status: ${form.status}
        Fields: ${form.fields?.map((f) => f.label).join(', ') || 'None'}
        Submission Count: ${form.submissions?.length || 0}
        Created At: ${form.createdAt ? new Date(form.createdAt).toLocaleDateString() : 'Unknown'}
      `,
      metadata: {
        type: 'lead_form',
        id: form._id.toString(),
        title: form.title,
        workspaceId: workspaceId,
      },
    }));

    // Process submissions
    const leadSubmissionDocs = leadSubmissions.map((submission) => {
      // Extract field values
      const fieldValues =
        submission.fieldValues?.map((fv) => `${fv.fieldId}: ${fv.value}`).join(', ') || 'No values';

      return {
        pageContent: `
          Lead Submission ID: ${submission._id}
          Form ID: ${submission.formId}
          Values: ${fieldValues}
          Created At: ${
            submission.createdAt ? new Date(submission.createdAt).toLocaleDateString() : 'Unknown'
          }
        `,
        metadata: {
          type: 'lead_submission',
          id: submission._id.toString(),
          formId: submission.formId?.toString(),
          workspaceId: workspaceId,
        },
      };
    });

    // Combine documents
    const leadDocs = [...leadFormDocs, ...leadSubmissionDocs];

    if (leadDocs.length > 0) {
      // Add to main vector store and domain-specific store
      await vectorStore.addDocuments(leadDocs);
      await domainStore.addDocuments(leadDocs);

      console.log(`Added ${leadDocs.length} lead documents for workspace ${workspaceId}`);
    }
  } catch (error) {
    console.error('Error loading lead data:', error);
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
      console.log(`Processing table: ${table.name}`);

      // Fetch sample records
      const records = await Record.find({ tableId: table._id }).limit(50).lean();
      console.log(`Found ${records.length} records for table ${table.name}`);

      // Build schema description
      const schemaDescription = `
        Table Name: ${table.name}
        ID: ${table._id}
        Description: ${table.description || 'No description'}
        Columns: ${table.columns?.map((c) => `${c.name} (${c.type})`).join(', ') || 'None'}
      `;

      // Create records description
      let recordsDescription = '';
      if (records.length > 0) {
        recordsDescription = 'Sample Records:\n';
        records.forEach((record, index) => {
          let valEntries = [];
          if (record.values) {
            if (typeof record.values.entries === 'function') {
              // It's a Map
              valEntries = Array.from(record.values.entries());
            } else if (typeof record.values === 'object') {
              // It's a regular object
              valEntries = Object.entries(record.values);
            }
          }

          const values = valEntries
            .map(([colId, val]) => {
              const col = table.columns?.find((c) => c.id === colId);
              return `${col?.name || colId}: ${JSON.stringify(val)}`;
            })
            .join(', ');

          recordsDescription += `  Record ${index + 1}: ${values}\n`;
        });
      }

      // Create document
      const tableDoc = {
        pageContent: `${schemaDescription}\n${recordsDescription}`,
        metadata: {
          type: 'table',
          id: table._id.toString(),
          name: table.name,
          workspaceId: workspaceId,
        },
      };

      // Add to main vector store and domain-specific store
      await vectorStore.addDocuments([tableDoc]);
      await domainStore.addDocuments([tableDoc]);

      console.log(`Added table ${table.name} to vector stores for workspace ${workspaceId}`);
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

// Function to infer workspace type
function inferWorkspaceType(tables, projects, leadForms) {
  const tableNames = tables.map((t) => t.name.toLowerCase()).join(' ');
  const projectCount = projects?.length || 0;
  const leadFormCount = leadForms?.length || 0;

  let types = [];

  // Check for project management characteristics
  if (projectCount > 0 || tableNames.includes('project') || tableNames.includes('task')) {
    types.push('project management');
  }

  // Check for CRM characteristics
  if (leadFormCount > 0 || tableNames.includes('lead') || tableNames.includes('customer')) {
    types.push('customer relationship management (CRM)');
  }

  // Check for e-commerce
  if (
    tableNames.includes('product') ||
    tableNames.includes('order') ||
    tableNames.includes('inventory')
  ) {
    types.push('e-commerce');
  }

  // Check for healthcare
  if (
    tableNames.includes('patient') ||
    tableNames.includes('appointment') ||
    tableNames.includes('medical')
  ) {
    types.push('healthcare management');
  }

  // Check for educational
  if (
    tableNames.includes('student') ||
    tableNames.includes('course') ||
    tableNames.includes('class')
  ) {
    types.push('educational management');
  }

  if (types.length === 0) {
    return 'data management';
  }

  return types.join(' and ');
}

// For backward compatibility
export function clearRetrieverCache(workspaceId) {
  // Clear any retriever caches specific to this workspace
  console.log(`Clearing retriever cache for workspace ${workspaceId}`);
}
