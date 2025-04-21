import Submission from '../../models/LeadForm/SubmissionSchema.js';
import { handleError } from '../../utils/errorHandler.js';

const getWorkspaceSubmissions = async (req, res) => {
  try {
    const workspace = req.workspace;
    const submissions = await Submission.find({ workspace: workspace._id })
      .populate('leadForm')
      .lean()
      .sort({ createdAt: -1 });

    console.log('🚀 submissions:', submissions);

    res.json(submissions);
  } catch (error) {
    handleError(res, error);
  }
};

export default getWorkspaceSubmissions;
