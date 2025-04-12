import Invoice from '../../models/invoiceModel.js';
import ProductCatalog from '../../models/ProductCatalog.js';
import Project from '../../models/Project.js';
import Workspace from '../../models/Workspace.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const createProjectInvoice = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { clientId, items, deliveryMethod, memo, footer, tax } = req.body;

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Check if user has permission to create invoice for this project
    if (
      project.createdBy.toString() !== req.user.userId &&
      project.manager?.toString() !== req.user.userId
    ) {
      throw new ApiError(403, 'You do not have permission to create an invoice for this project');
    }

    // Validate required fields
    if (!clientId) {
      throw new ApiError(400, 'Client ID is required');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, 'At least one item is required');
    }

    // Fetch product details for each item
    const productDetails = [];
    let subtotal = 0;

    // Validate that all items exist in ProductCatalog
    for (const itemId of items) {
      const product = await ProductCatalog.findById(itemId);
      if (!product) {
        throw new ApiError(400, `Product with ID ${itemId} not found in catalog`);
      }

      productDetails.push(product._id);
      subtotal += product.price || 0;
    }

    const workspace = await Workspace.findById(req.workspace._id);
    const invoiceSettings = workspace.invoiceSettings || {};

    // Calculate tax amount if tax is provided
    const taxAmount = tax ? (subtotal * tax.rate) / 100 : 0;
    const total = subtotal + taxAmount;

    // Generate invoice number (you might want to implement a more sophisticated system)
    const invoiceNumber = `INV-${Date.now()}`;

    // Set due date (30 days from now by default)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // Create new invoice
    const invoice = new Invoice({
      invoiceNumber,
      project: projectId,
      client: clientId,
      items: productDetails,
      subtotal,
      tax: taxAmount,
      total,
      status: 'draft',
      dueDate,
      notes: memo,
      paymentTerms: footer,
      currency: invoiceSettings.currency || 'USD',
      deliveryMethod: deliveryMethod || invoiceSettings.deliveryMethod || 'email',
      workspace: req.workspace._id,
      createdBy: req.user.userId,
    });

    // Save the invoice
    await invoice.save();

    // Update project with the new invoice
    project.invoices = project.invoices || [];
    project.invoices.push(invoice._id);
    await project.save();

    // Send the response back to the client
    res.status(201).json(new ApiResponse(201, invoice, 'Invoice created successfully'));
  } catch (error) {
    next(error);
  }
};
