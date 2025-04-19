import LeadForm from '../../models/LeadForm.js';
import { handleError } from '../../utils/errorHandler.js';

// Get all lead forms for a workspace
export const getLeadForms = async (req, res) => {
  try {
    const workspace = req.workspace;
    const query = { workspace: workspace._id };

    // Add status filter if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    const leadForms = await LeadForm.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(leadForms);
  } catch (error) {
    handleError(res, error);
  }
};
