import { OpenAIEmbeddings } from '@langchain/openai';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';
import Record from '../../models/Table/Record.js';
import Table from '../../models/Table/Table.js';

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

  // Create a workspace summary document
  let workspaceSummary = `This workspace contains ${tables.length} tables:\n\n`;

  // Add detailed information about each table
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
  workspaceSummary += `\nWorkspace Overview:\n`;
  workspaceSummary += `This appears to be a ${
    tables.length > 5 ? 'complex' : 'simple'
  } database with `;
  workspaceSummary += `multiple tables that might represent a ${inferWorkspaceType(
    tables,
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

  return vectorStore;
}

// Helper function to infer workspace type based on table names
function inferWorkspaceType(tables) {
  const tableNames = tables.map((t) => t.name.toLowerCase());
  const nameString = tableNames.join(' ');

  if (
    nameString.includes('user') ||
    nameString.includes('account') ||
    nameString.includes('profile')
  ) {
    return 'user management';
  }
  if (
    nameString.includes('product') ||
    nameString.includes('inventory') ||
    nameString.includes('order')
  ) {
    return 'e-commerce or inventory management';
  }
  if (
    nameString.includes('patient') ||
    nameString.includes('appointment') ||
    nameString.includes('medical')
  ) {
    return 'healthcare';
  }
  if (
    nameString.includes('student') ||
    nameString.includes('course') ||
    nameString.includes('class')
  ) {
    return 'educational';
  }
  if (
    nameString.includes('task') ||
    nameString.includes('project') ||
    nameString.includes('ticket')
  ) {
    return 'project management';
  }

  return 'data management';
}
