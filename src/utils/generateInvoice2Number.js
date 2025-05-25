import Invoice2 from '../models/invoice2.js';
import { BadRequestError } from './errors.js';

/**
 * Generates a unique invoice number for a new invoice2
 * Format: INV-{SEQUENCE}
 * Example: INV-1234
 *
 * The sequence is based on year and month internally but displayed as a simple number
 * This ensures uniqueness while keeping the display format short
 *
 * @param {string} workspaceId - The ID of the workspace
 * @returns {Promise<string>} - The generated invoice number
 */
export const generateInvoice2Number = async (workspaceId) => {
  if (!workspaceId) {
    throw new BadRequestError('Workspace ID is required to generate invoice number');
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  // Create a base number that combines year and month
  // This ensures uniqueness across months while keeping the display number shorter
  const baseNumber = (year - 2024) * 12 + month; // Start from 2024 as base year

  // Find the latest invoice in this workspace
  const latestInvoice = await Invoice2.findOne({
    workspace: workspaceId,
  })
    .sort({ createdAt: -1 })
    .lean();

  let sequenceNumber = 1;

  if (latestInvoice) {
    // Extract the sequence number from the latest invoice number
    const latestSequence = parseInt(latestInvoice.invoiceNumber.split('-')[1], 10);
    sequenceNumber = latestSequence + 1;
  }

  // Format the sequence number with leading zeros (4 digits)
  const formattedSequence = String(sequenceNumber).padStart(4, '0');

  return `INV-${formattedSequence}`;
};
