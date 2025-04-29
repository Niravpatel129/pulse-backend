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

let vectorStore;
let mongoClient;

// Domain-specific vector stores for better search performance
const vectorStores = {
  workspace: null,
  projects: null,
  users: null,
  leads: null,
  meetings: null,
  tables: null,
};

export async function initVectorStore() {
  // Return cached vector store if already initialized
  if (vectorStore) {
    console.log('Using cached vector store');
    return vectorStore;
  }

  console.log('Initializing vector store...');

  // 1️⃣ Connect MongoDB Driver with connection pooling for better scalability
  mongoClient = new MongoClient(process.env.MONGO_URI, {
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

  // Create domain-specific vector stores for better search performance
  for (const domain of Object.keys(vectorStores)) {
    vectorStores[domain] = new MemoryVectorStore(embeddings);
  }

  // Main vector store that can search across all domains
  vectorStore = new MemoryVectorStore(embeddings);

  // 3️⃣ Connect Mongoose with optimized connection settings
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.DB_NAME,
    maxPoolSize: 10,
    minPoolSize: 2,
    socketTimeoutMS: 30000,
  });
  console.log('Connected to Mongoose');

  // 4️⃣ Load data in parallel for better performance
  await Promise.all([
    loadWorkspaceData(),
    loadProjectData(),
    loadUserData(),
    loadLeadData(),
    loadMeetingData(),
    loadTableData(),
  ]);

  console.log('Vector store initialization complete');
  return vectorStore;
}

// Helper function to load workspace data
async function loadWorkspaceData() {
  try {
    const workspaces = await Workspace.find().populate('members.user createdBy').lean();

    if (!workspaces || workspaces.length === 0) {
      console.log('No workspace data found');
      return;
    }

    console.log(`Loading ${workspaces.length} workspaces`);

    const workspaceSummaries = [];

    for (const workspace of workspaces) {
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

      workspaceSummaries.push({
        pageContent: summary,
        metadata: {
          type: 'workspace',
          id: workspace._id.toString(),
          name: workspace.name,
        },
      });
    }

    // Add to main vector store and domain-specific store
    await vectorStore.addDocuments(workspaceSummaries);
    await vectorStores.workspace.addDocuments(workspaceSummaries);

    console.log(`Added ${workspaceSummaries.length} workspace summaries to vector stores`);
  } catch (error) {
    console.error('Error loading workspace data:', error);
  }
}

// Helper function to load project data
async function loadProjectData() {
  try {
    const projects = await Project.find().populate('team.user manager createdBy').lean();

    if (!projects || projects.length === 0) {
      console.log('No project data found');
      return;
    }

    console.log(`Loading ${projects.length} projects`);

    // Process in chunks of 50 for better memory management
    const CHUNK_SIZE = 50;
    for (let i = 0; i < projects.length; i += CHUNK_SIZE) {
      const chunk = projects.slice(i, i + CHUNK_SIZE);

      const projectDocs = chunk.map((project) => ({
        pageContent: `
          Project: ${project.name}
          ID: ${project._id}
          Status: ${project.status}
          Stage: ${project.stage}
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
          status: project.status,
        },
      }));

      // Add to main vector store and domain-specific store
      await vectorStore.addDocuments(projectDocs);
      await vectorStores.projects.addDocuments(projectDocs);

      console.log(`Added ${projectDocs.length} project documents (chunk ${i / CHUNK_SIZE + 1})`);
    }
  } catch (error) {
    console.error('Error loading project data:', error);
  }
}

// Helper function to load user data
async function loadUserData() {
  try {
    const users = await User.find().select('-password').lean();

    if (!users || users.length === 0) {
      console.log('No user data found');
      return;
    }

    console.log(`Loading ${users.length} users`);

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
      },
    }));

    // Add to main vector store and domain-specific store
    await vectorStore.addDocuments(userDocs);
    await vectorStores.users.addDocuments(userDocs);

    console.log(`Added ${userDocs.length} user documents`);
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}

// Helper function to load lead data
async function loadLeadData() {
  try {
    const leadForms = await LeadForm.find().lean();
    const leadSubmissions = await Submission.find().limit(200).lean();

    if (
      (!leadForms || leadForms.length === 0) &&
      (!leadSubmissions || leadSubmissions.length === 0)
    ) {
      console.log('No lead data found');
      return;
    }

    console.log(`Loading ${leadForms.length} lead forms and ${leadSubmissions.length} submissions`);

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
        },
      };
    });

    // Combine documents
    const leadDocs = [...leadFormDocs, ...leadSubmissionDocs];

    // Add to main vector store and domain-specific store
    await vectorStore.addDocuments(leadDocs);
    await vectorStores.leads.addDocuments(leadDocs);

    console.log(`Added ${leadDocs.length} lead documents`);
  } catch (error) {
    console.error('Error loading lead data:', error);
  }
}

// Helper function to load meeting data
async function loadMeetingData() {
  try {
    const meetings = await Meeting.find().populate('participants.participant organizer').lean();

    if (!meetings || meetings.length === 0) {
      console.log('No meeting data found');
      return;
    }

    console.log(`Loading ${meetings.length} meetings`);

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
      },
    }));

    // Add to main vector store and domain-specific store
    await vectorStore.addDocuments(meetingDocs);
    await vectorStores.meetings.addDocuments(meetingDocs);

    console.log(`Added ${meetingDocs.length} meeting documents`);
  } catch (error) {
    console.error('Error loading meeting data:', error);
  }
}

// Helper function to load table data
async function loadTableData() {
  try {
    const tables = await Table.find().lean();

    if (!tables || tables.length === 0) {
      console.log('No table data found');
      return;
    }

    console.log(`Loading ${tables.length} tables`);

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
        },
      };

      // Add to main vector store and domain-specific store
      await vectorStore.addDocuments([tableDoc]);
      await vectorStores.tables.addDocuments([tableDoc]);

      console.log(`Added table ${table.name} to vector stores`);
    }
  } catch (error) {
    console.error('Error loading table data:', error);
  }
}

// Get domain-specific vector store for more focused searches
export function getDomainVectorStore(domain) {
  if (!vectorStores[domain]) {
    console.warn(`Domain vector store for '${domain}' not found, using main vector store`);
    return vectorStore;
  }
  return vectorStores[domain];
}

// Clean up function to close connections when shutting down
export async function closeVectorStore() {
  if (mongoClient) {
    await mongoClient.close();
    console.log('MongoDB connection closed');
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('Mongoose connection closed');
  }

  // Clear vector stores
  vectorStore = null;
  for (const domain of Object.keys(vectorStores)) {
    vectorStores[domain] = null;
  }

  console.log('Vector stores cleared');
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
