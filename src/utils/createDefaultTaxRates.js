import InvoiceTaxRate from '../models/invoiceTaxRateModel.js';

/**
 * Creates default tax rates for a new workspace
 * @param {string} workspaceId - The ID of the workspace
 * @param {string} userId - The ID of the user creating the workspace
 */
export const createDefaultTaxRates = async (workspaceId, userId) => {
  try {
    // Create default tax rates
    const defaultTaxRates = [
      {
        name: 'No Tax',
        rate: 0,
        description: 'No tax applied',
        isDefault: true,
        workspace: workspaceId,
        createdBy: userId,
      },
      {
        name: 'VAT',
        rate: 20,
        description: 'Value Added Tax',
        isDefault: false,
        workspace: workspaceId,
        createdBy: userId,
      },
      {
        name: 'Sales Tax',
        rate: 8.5,
        description: 'General Sales Tax',
        isDefault: false,
        workspace: workspaceId,
        createdBy: userId,
      },
    ];

    await InvoiceTaxRate.insertMany(defaultTaxRates);
    console.log(`Created default tax rates for workspace: ${workspaceId}`);
  } catch (error) {
    console.error('Error creating default tax rates:', error);
  }
};
