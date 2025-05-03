import Invoice from '../../models/invoiceModel.js';
import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const markProjectInvoiceAsPaid = async (req, res, next) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.userId;

    // Find the invoice
    const invoice = await Invoice.findById(invoiceId);

    // find the project so we can update the state
    const project = await Project.findById(invoice.project);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }
    if (!invoice) {
      throw new ApiError(404, 'Invoice not found');
    }

    // Check if user has permission to update this invoice
    if (invoice.workspace.toString() !== req.workspace._id.toString()) {
      throw new ApiError(403, 'You do not have permission to update this invoice');
    }

    // update the project state
    project.state = 'invoice-paid';
    await project.save();

    // Update the invoice status to paid
    invoice.status = 'paid';
    invoice.paidAt = new Date(); // Record payment timestamp
    invoice.paidBy = userId;

    // Save the updated invoice
    await invoice.save();

    // Send response
    res.status(200).json(new ApiResponse(200, invoice, 'Invoice marked as paid successfully'));
  } catch (error) {
    next(error);
  }
};
