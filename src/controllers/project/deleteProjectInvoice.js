import Invoice from '../../models/invoiceModel.js';
import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const deleteProjectInvoice = async (req, res, next) => {
  try {
    const { projectId, invoiceId } = req.params;

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Check if user has permission to delete invoice for this project
    if (
      project.createdBy.toString() !== req.user.userId &&
      project.manager?.toString() !== req.user.userId
    ) {
      throw new ApiError(403, 'You do not have permission to delete invoices for this project');
    }

    // Find the invoice
    const invoice = await Invoice.findOne({ _id: invoiceId, project: projectId });
    if (!invoice) {
      throw new ApiError(404, 'Invoice not found for this project');
    }

    // Delete the invoice
    await Invoice.findByIdAndDelete(invoiceId);

    res.status(200).json(new ApiResponse(200, null, 'Invoice deleted successfully'));
  } catch (error) {
    next(error);
  }
};
