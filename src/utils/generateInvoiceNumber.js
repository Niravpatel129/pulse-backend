import Invoice from '../models/invoiceModel.js';
import { BadRequestError } from './errors.js';

/**
 * Generates a unique invoice number for a new invoice
 * Format: INV-{YEAR}{MONTH}-{SEQUENCE}
 * Example: INV-202401-0001
 *
 * @param {string} workspaceId - The ID of the workspace
 * @returns {Promise<string>} - The generated invoice number
 */
export const generateInvoiceNumber = async (workspaceId) => {
  if (!workspaceId) {
    throw new BadRequestError('Workspace ID is required to generate invoice number');
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const prefix = `INV-${year}${month}-`;

  // Find the latest invoice with the same prefix in this workspace
  const latestInvoice = await Invoice.findOne({
    invoiceNumber: { $regex: `^${prefix}` },
    workspace: workspaceId,
  })
    .sort({ invoiceNumber: -1 })
    .lean();

  let sequenceNumber = 1;

  if (latestInvoice) {
    // Extract the sequence number from the latest invoice number
    const latestSequence = latestInvoice.invoiceNumber.split('-')[2];
    sequenceNumber = parseInt(latestSequence, 10) + 1;
  }

  // Format the sequence number with leading zeros (4 digits)
  const formattedSequence = String(sequenceNumber).padStart(4, '0');

  return `${prefix}${formattedSequence}`;
};
