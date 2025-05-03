import Invoice from '../../models/invoiceModel.js';
import Project from '../../models/Project.js';
import Workspace from '../../models/Workspace.js';
import ApiResponse from '../../utils/apiResponse.js';

const getProjectInvoice = async (req, res) => {
  try {
    const { projectId } = req.params;
    const workspaceId = req.workspace._id;

    if (!projectId) {
      return res.status(400).json(new ApiResponse(400, null, 'Project ID is required'));
    }

    // Verify the project exists and belongs to the workspace
    const project = await Project.findOne({
      _id: projectId,
      workspace: workspaceId,
    });

    if (!project) {
      return res.status(404).json(new ApiResponse(404, null, 'Project not found'));
    }

    // Find the latest invoice related to this project
    const invoice = await Invoice.findOne({ project: projectId })
      .populate('client')
      .populate('items')
      .sort({ createdAt: -1 });

    // Get workspace for invoice settings
    const workspace = await Workspace.findById(workspaceId);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          project,
          invoice,
          workspaceSettings: workspace?.invoiceSettings || {},
        },
        'Project invoice retrieved successfully',
      ),
    );
  } catch (error) {
    console.error('Error fetching project invoice:', error);
    return res.status(500).json(new ApiResponse(500, null, 'Failed to fetch project invoice'));
  }
};

export default getProjectInvoice;
