import Invoice from '../../models/invoiceModel.js';
import Project from '../../models/Project.js';
import Workspace from '../../models/Workspace.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const createProjectInvoiceV2 = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const {
      selectedItems,
      selectedClient,
      dueDate,
      taxRate,
      notes,
      taxId,
      showTaxId,
      discount = 0,
      subtotal,
      shippingTotal = 0,
      discountAmount,
      total,
      currency,
      selectedTax,
      deliveryOptions,
      shipping,
    } = req.body;

    if (!projectId) {
      throw new ApiError(400, 'Project ID is required');
    }

    // Validate required fields
    if (!selectedItems || !selectedItems.length || !subtotal || !total) {
      throw new ApiError(400, 'Missing required invoice fields');
    }

    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Get workspace invoice settings
    const workspace = await Workspace.findById(req.workspace._id);
    const invoiceSettings = workspace.invoiceSettings || {};

    // Get current date for invoice date if not provided
    const invoiceDate = new Date();

    // Determine due date: user provided, settings default, or 30 days
    const defaultDueDays = invoiceSettings.defaultDueDays || 30;
    const calculatedDueDate =
      dueDate || new Date(invoiceDate.getTime() + defaultDueDays * 24 * 60 * 60 * 1000);

    // Create the invoice with settings applied
    const invoice = await Invoice.create({
      project: projectId,
      invoiceNumber: invoiceSettings.invoicePrefix
        ? `${invoiceSettings.invoicePrefix}-${Date.now()}`
        : `INV-${Date.now()}`,
      invoiceDate,
      dueDate: calculatedDueDate,
      items: [], // Legacy field - keeping for compatibility
      selectedItems,
      notes,
      status: 'draft',
      client: selectedClient?._id || project.client,
      selectedClient,
      subtotal,
      discount: discount || 0,
      discountAmount: discountAmount || 0,
      tax: taxRate || 0,
      taxRate: taxRate || 0,
      taxAmount: (selectedTax && selectedTax.amount) || 0,
      taxId: taxId || '',
      showTaxId: showTaxId || false,
      selectedTax,
      total,
      currency: currency || invoiceSettings.currency || 'usd',
      deliveryOptions: deliveryOptions || invoiceSettings.deliveryMethod || 'email',
      shipping,
      shippingTotal: shippingTotal || 0,
      paymentTerms: invoiceSettings.paymentTerms || '',
      createdBy: req.user.userId,
      workspace: req.workspace._id,
    });

    // Update project with the new invoice if needed
    if (project.invoices) {
      project.invoices.push(invoice._id);
      project.state = 'invoice-created';
      await project.save();
    }

    res.status(201).json(new ApiResponse(201, invoice, 'Project invoice created successfully'));
  } catch (error) {
    next(error);
  }
};
