import LeadForm from '../../models/LeadForm.js';
import { handleError } from '../../utils/errorHandler.js';

const getWorkspaceSubmissions = async (req, res) => {
  try {
    const workspace = req.workspace;
    const submissions = await LeadForm.find({ workspace: workspace._id })
      .select('submissions')
      .lean()
      .sort({ createdAt: -1 });

    res.json(submissions);
  } catch (error) {
    handleError(res, error);
  }
};

export default getWorkspaceSubmissions;
