import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Record from '../models/Table/Record.js';
import Row from '../models/Table/Row.js';
import Table from '../models/Table/Table.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pulse');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Function to get all rows and their values for a specific table
const getTableData = async (tableId) => {
  try {
    // Find the table
    const table = await Table.findById(tableId);
    if (!table) {
      console.log(`Table with ID ${tableId} not found`);
      return;
    }

    console.log(`Table found: ${table.name}`);

    // Get all rows for the table
    const rows = await Row.find({ tableId }).sort({ position: 1 });
    console.log(`Found ${rows.length} rows`);

    // Get all records for these rows
    const records = await Record.find({
      tableId,
      rowId: { $in: rows.map((row) => row._id) },
    });

    // Create a map of rowId to record values for easier lookup
    const recordMap = new Map();
    records.forEach((record) => {
      if (!recordMap.has(record.rowId.toString())) {
        recordMap.set(record.rowId.toString(), {});
      }
      const rowValues = recordMap.get(record.rowId.toString());
      rowValues[record.columnId] = record.values.get(record.columnId);
    });

    // Process each row and concatenate values
    const results = rows.map((row) => {
      const rowValues = recordMap.get(row._id.toString()) || {};

      // Convert all values to a single string
      const displayValue = Object.values(rowValues)
        .filter((value) => value !== undefined && value !== null)
        .join(', ');

      return {
        rowId: row._id,
        position: row.position,
        values: displayValue || 'No values',
      };
    });

    // Log the results
    console.log('Table Data:');
    results.forEach((result) => {
      console.log(`Row ${result.position}: ${result.values}`);
    });

    return results;
  } catch (error) {
    console.error('Error getting table data:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();

  const tableId = '67ee804da6be35f7c88f122c';
  await getTableData(tableId);

  // Close the connection
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
};

// Run the script
main().catch((error) => {
  console.error('Script error:', error);
  process.exit(1);
});
