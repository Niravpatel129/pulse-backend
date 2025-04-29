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

export async function initVectorStore() {
  if (vectorStore) return vectorStore;

  // 1️⃣ Connect MongoDB Driver (for vector search)
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();

  const collection = client.db(process.env.DB_NAME).collection(process.env.VECTOR_COLLECTION_NAME);

  // 2️⃣ Build the LangChain-backed Atlas vector store
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: 'text-embedding-ada-002',
    stripNewLines: true,
  });

  // Create an in-memory vector store for testing instead
  const { MemoryVectorStore } = await import('langchain/vectorstores/memory');
  vectorStore = new MemoryVectorStore(embeddings);

  // 3️⃣ Connect Mongoose (for reading your schemas & records)
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.DB_NAME,
  });

  // 4️⃣ Fetch all tables in this workspace
  const tables = await Table.find().lean();
  console.log(`Found ${tables.length} tables`);

  // Fetch projects, users, leads and meetings
  const projects = await Project.find().populate('team.user manager createdBy').lean();
  const users = await User.find().select('-password').lean();
  const leadForms = await LeadForm.find().lean();
  const leadSubmissions = await Submission.find().limit(100).lean();
  const meetings = await Meeting.find().populate('participants.participant organizer').lean();
  const workspaces = await Workspace.find().populate('members.user createdBy').lean();

  console.log(
    `Found ${projects.length} projects, ${users.length} users, ${leadForms.length} lead forms, ${meetings.length} meetings`,
  );

  // Create a workspace summary document
  let workspaceSummary = `This workspace contains ${tables.length} tables, ${projects.length} projects, ${users.length} users, and ${leadForms.length} lead forms.\n\n`;

  // Add detailed information about each table
  workspaceSummary += `DATABASE TABLES:\n`;
  tables.forEach((table) => {
    const columnCount = table.columns?.length || 0;
    workspaceSummary += `Table "${table.name}":\n`;
    workspaceSummary += `- Contains ${columnCount} columns\n`;

    // Add column information
    if (table.columns && table.columns.length > 0) {
      workspaceSummary += `- Key columns: ${table.columns
        .slice(0, 5)
        .map((c) => c.name)
        .join(', ')}\n`;
    }

    // Add table description if it exists
    if (table.description) {
      workspaceSummary += `- Description: ${table.description}\n`;
    }

    // Infer relationships between tables (based on column names)
    const possibleRelationColumns =
      table.columns?.filter(
        (col) =>
          col.name.toLowerCase().includes('id') ||
          col.name.toLowerCase().includes('ref') ||
          col.name.toLowerCase().endsWith('_id'),
      ) || [];

    if (possibleRelationColumns.length > 0) {
      workspaceSummary += `- Possible relationships: ${possibleRelationColumns
        .map((c) => c.name)
        .join(', ')}\n`;
    }

    workspaceSummary += '\n';
  });

  // Add workspace overview
  workspaceSummary += `WORKSPACE OVERVIEW:\n`;
  if (workspaces && workspaces.length > 0) {
    const primaryWorkspace = workspaces[0];
    workspaceSummary += `Workspace Name: ${primaryWorkspace.name || 'Unnamed'}\n`;
    workspaceSummary += `Description: ${
      primaryWorkspace.description || 'No description available'
    }\n`;
    workspaceSummary += `Created by: ${primaryWorkspace.createdBy?.name || 'Unknown'}\n`;
    workspaceSummary += `Member count: ${primaryWorkspace.members?.length || 0}\n\n`;
  }

  // Add project information
  workspaceSummary += `PROJECTS:\n`;
  projects.forEach((project) => {
    workspaceSummary += `Project "${project.name}":\n`;
    workspaceSummary += `- Status: ${project.status}\n`;
    workspaceSummary += `- Stage: ${project.stage}\n`;
    workspaceSummary += `- Description: ${project.description || 'No description'}\n`;
    workspaceSummary += `- Manager: ${project.manager?.name || 'Unassigned'}\n`;
    workspaceSummary += `- Team Members: ${project.team?.length || 0}\n`;
    workspaceSummary += `- Start Date: ${
      project.startDate ? new Date(project.startDate).toLocaleDateString() : 'Not set'
    }\n`;
    workspaceSummary += `- Target Date: ${
      project.targetDate ? new Date(project.targetDate).toLocaleDateString() : 'Not set'
    }\n`;
    workspaceSummary += `- Created By: ${project.createdBy?.name || 'Unknown'}\n\n`;
  });

  // Add team members information
  workspaceSummary += `TEAM MEMBERS:\n`;
  users.forEach((user) => {
    workspaceSummary += `${user.name} (${user.email}):\n`;
    workspaceSummary += `- Role: ${user.role}\n`;
    workspaceSummary += `- Job Title: ${user.jobTitle || 'Not specified'}\n`;
    workspaceSummary += `- Bio: ${user.bio || 'No bio available'}\n\n`;
  });

  // Add lead forms information
  workspaceSummary += `LEAD FORMS:\n`;
  leadForms.forEach((form) => {
    workspaceSummary += `Lead Form "${form.title}":\n`;
    workspaceSummary += `- Description: ${form.description || 'No description'}\n`;
    workspaceSummary += `- Status: ${form.status}\n`;
    workspaceSummary += `- Submissions: ${form.submissions?.length || 0}\n\n`;
  });

  // Add meetings information
  workspaceSummary += `UPCOMING MEETINGS:\n`;
  const today = new Date();
  const upcomingMeetings = meetings.filter((m) => new Date(m.date) >= today);

  if (upcomingMeetings.length === 0) {
    workspaceSummary += `No upcoming meetings scheduled.\n\n`;
  } else {
    upcomingMeetings.forEach((meeting) => {
      workspaceSummary += `Meeting "${meeting.title}":\n`;
      workspaceSummary += `- Date: ${new Date(meeting.date).toLocaleDateString()}\n`;
      workspaceSummary += `- Time: ${meeting.startTime} - ${meeting.endTime}\n`;
      workspaceSummary += `- Type: ${meeting.type}\n`;
      workspaceSummary += `- Status: ${meeting.status}\n`;
      workspaceSummary += `- Organizer: ${meeting.organizer?.name || 'Unknown'}\n`;
      workspaceSummary += `- Participants: ${meeting.participants?.length || 0}\n\n`;
    });
  }

  workspaceSummary += `This appears to be a ${inferWorkspaceType(
    tables,
    projects,
    leadForms,
  )} system.\n`;

  // Add workspace summary to vector store
  try {
    await vectorStore.addDocuments([
      {
        pageContent: workspaceSummary,
        metadata: { type: 'workspace_summary' },
      },
    ]);
    console.log('Successfully added workspace summary to vector store');
  } catch (error) {
    console.error('Error adding workspace summary:', error);
  }

  // 5️⃣ For each table, build a "document" string and index it
  for (const table of tables) {
    console.log(`Processing table: ${table.name}`);
    // 5a. Fetch up to N sample records
    const recs = await Record.find({ tableId: table._id }).limit(50).lean();
    console.log(`Found ${recs.length} records for table ${table.name}`);

    // 5b. Build a schema+records text blob
    const schemaText =
      `Table "${table.name}" has columns:\n` +
      (table.columns || []).map((c) => `  - ${c.name} (id:${c.id}, type:${c.type})`).join('\n') +
      '\nRecords:\n' +
      recs
        .map((r) => {
          // Handle different formats of values (Map or Object)
          let valEntries = [];
          if (r.values) {
            if (typeof r.values.entries === 'function') {
              // It's a Map
              valEntries = Array.from(r.values.entries());
            } else if (typeof r.values === 'object') {
              // It's a regular object
              valEntries = Object.entries(r.values);
            }
          }

          const vals = valEntries
            .map(([colId, val]) => {
              const col = table.columns?.find((c) => c.id === colId);
              return `${col?.name || colId}: ${JSON.stringify(val)}`;
            })
            .join(', ');
          return `  • ${r.rowId || 'Unknown'}: ${vals}`;
        })
        .join('\n');

    console.log(`Adding document for table ${table.name} to vector store`);
    // 5c. Upsert into vector store
    try {
      await vectorStore.addDocuments([
        {
          pageContent: schemaText,
          metadata: { tableName: table.name },
        },
      ]);
      console.log(`Successfully added document for table ${table.name}`);
    } catch (error) {
      console.error(`Error adding document for table ${table.name}:`, error);
    }
  }

  // Add detailed project information
  for (const project of projects) {
    const projectText = `
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
      Active: ${project.isActive ? 'Yes' : 'No'}
      Closed: ${project.isClosed ? 'Yes' : 'No'}
      Archived: ${project.isArchived ? 'Yes' : 'No'}
      
      Team Members:
      ${
        project.team && project.team.length > 0
          ? project.team
              .map(
                (member) =>
                  `- ${member.user?.name || 'Unknown'} (${member.user?.email || 'No email'})`,
              )
              .join('\n')
          : 'No team members assigned'
      }
      
      Tasks:
      ${
        project.tasks && project.tasks.length > 0
          ? project.tasks
              .map(
                (task) =>
                  `- ${task.title} (${task.status}) - Due: ${
                    task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'
                  }`,
              )
              .join('\n')
          : 'No tasks added'
      }
    `;

    try {
      await vectorStore.addDocuments([
        {
          pageContent: projectText,
          metadata: {
            type: 'project',
            projectId: project._id.toString(),
            projectName: project.name,
          },
        },
      ]);
      console.log(`Successfully added project ${project.name} to vector store`);
    } catch (error) {
      console.error(`Error adding project ${project.name}:`, error);
    }
  }

  // Add detailed user information
  for (const user of users) {
    const userText = `
      User: ${user.name}
      ID: ${user._id}
      Email: ${user.email}
      Role: ${user.role}
      Job Title: ${user.jobTitle || 'Not specified'}
      Bio: ${user.bio || 'No bio available'}
      Phone: ${user.phone || 'Not provided'}
      Active: ${user.isActive ? 'Yes' : 'No'}
      Email Verified: ${user.isEmailVerified ? 'Yes' : 'No'}
      Two-Factor Enabled: ${user.twoFactorEnabled ? 'Yes' : 'No'}
      Timezone: ${user.timezone || 'Not set'}
    `;

    try {
      await vectorStore.addDocuments([
        {
          pageContent: userText,
          metadata: {
            type: 'user',
            userId: user._id.toString(),
            userName: user.name,
            userEmail: user.email,
          },
        },
      ]);
      console.log(`Successfully added user ${user.name} to vector store`);
    } catch (error) {
      console.error(`Error adding user ${user.name}:`, error);
    }
  }

  // Add lead form information
  for (const form of leadForms) {
    const formText = `
      Lead Form: ${form.title}
      ID: ${form._id}
      Description: ${form.description || 'No description'}
      Status: ${form.status}
      Number of Elements: ${form.elements?.length || 0}
      Number of Submissions: ${form.submissions?.length || 0}
      Created By: ${form.createdBy?.toString() || 'Unknown'}
      
      Form Elements:
      ${
        form.elements && form.elements.length > 0
          ? form.elements
              .map(
                (element) =>
                  `- ${element.label || element.id} (${element.type || 'No type'}) ${
                    element.required ? '(Required)' : '(Optional)'
                  }`,
              )
              .join('\n')
          : 'No form elements defined'
      }
    `;

    try {
      await vectorStore.addDocuments([
        {
          pageContent: formText,
          metadata: {
            type: 'leadForm',
            formId: form._id.toString(),
            formTitle: form.title,
          },
        },
      ]);
      console.log(`Successfully added lead form ${form.title} to vector store`);
    } catch (error) {
      console.error(`Error adding lead form ${form.title}:`, error);
    }
  }

  // Add meeting information
  for (const meeting of meetings) {
    const meetingText = `
      Meeting: ${meeting.title}
      ID: ${meeting._id}
      Description: ${meeting.description || 'No description'}
      Date: ${new Date(meeting.date).toLocaleDateString()}
      Time: ${meeting.startTime} - ${meeting.endTime}
      Location: ${meeting.location || 'Not specified'}
      Type: ${meeting.type}
      Status: ${meeting.status}
      Organizer: ${meeting.organizer?.name || 'Unknown'} (${meeting.organizer?.email || ''})
      
      Participants:
      ${
        meeting.participants && meeting.participants.length > 0
          ? meeting.participants
              .map((p) => `- ${p.participant?.name || 'Unknown'} (${p.type})`)
              .join('\n')
          : 'No participants added'
      }
    `;

    try {
      await vectorStore.addDocuments([
        {
          pageContent: meetingText,
          metadata: {
            type: 'meeting',
            meetingId: meeting._id.toString(),
            meetingTitle: meeting.title,
            meetingDate: meeting.date,
          },
        },
      ]);
      console.log(`Successfully added meeting ${meeting.title} to vector store`);
    } catch (error) {
      console.error(`Error adding meeting ${meeting.title}:`, error);
    }
  }

  return vectorStore;
}

// Helper function to infer workspace type based on table names and other elements
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
