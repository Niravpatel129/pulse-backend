import Invoice from '../../models/invoiceModel.js';
import Project from '../../models/Project.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

export const getProjectInvoices = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    console.log('🚀 projectId:', projectId);

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }

    // Check if user has permission to view invoices for this project
    if (
      project.createdBy.toString() !== req.user.userId &&
      project.manager?.toString() !== req.user.userId
    ) {
      throw new ApiError(403, 'You do not have permission to view invoices for this project');
    }

    // Get all invoices for the project
    const invoices = await Invoice.find({ project: projectId })
      .populate('client', 'name email')
      .populate('items', 'name description price')
      .sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, invoices, 'Project invoices retrieved successfully'));
  } catch (error) {
    next(error);
  }
};
