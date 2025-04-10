import Invoice from '../../models/invoiceModel.js';

export const generateInvoiceNumber = async (workspaceId) => {
  const count = await Invoice.countDocuments({ workspace: workspaceId });
  return `INV-${workspaceId.slice(-4)}-${String(count + 1).padStart(4, '0')}`;
};
