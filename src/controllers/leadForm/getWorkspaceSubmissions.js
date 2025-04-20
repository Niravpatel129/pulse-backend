import LeadForm from '../../models/LeadForm.js';
import { handleError } from '../../utils/errorHandler.js';

const getWorkspaceSubmissions = async (req, res) => {
  try {
    const workspace = req.workspace;
    const forms = await LeadForm.find({ workspace: workspace._id })
      .select('title submissions')
      .lean()
      .sort({ createdAt: -1 });

    // Inject formTitle into each submission
    const formsWithTitleInSubmissions = forms.map((form) => {
      const { title, submissions = [], ...rest } = form;

      // Add the formTitle to each submission
      const updatedSubmissions = submissions.map((submission) => ({
        ...submission,
        formTitle: title,
      }));

      return {
        ...rest,
        title,
        submissions: updatedSubmissions,
      };
    });

    res.json(formsWithTitleInSubmissions);
  } catch (error) {
    handleError(res, error);
  }
};

export default getWorkspaceSubmissions;
