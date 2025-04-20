import LeadForm from '../../models/LeadForm.js';
import { handleError } from '../../utils/errorHandler.js';

const deleteWorkspaceSubmission = async (req, res) => {
  const { id } = req.params;

  try {
    const leadForm = await LeadForm.findOne({ 'submissions._id': id });

    if (!leadForm) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    leadForm.submissions = leadForm.submissions.filter(
      (submission) => submission._id.toString() !== id,
    );
    await leadForm.save();

    res.json({ message: 'Submission deleted successfully' });
  } catch (error) {
    handleError(res, error);
  }
};

export default deleteWorkspaceSubmission;
