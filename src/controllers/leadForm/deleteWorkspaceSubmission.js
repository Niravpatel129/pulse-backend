import LeadForm from '../../models/LeadForm.js';
import Submission from '../../models/LeadForm/SubmissionSchema.js';
import { handleError } from '../../utils/errorHandler.js';

const deleteWorkspaceSubmission = async (req, res) => {
  const { id } = req.params;

  try {
    // Find the submission by ID
    const submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Find the lead form that references this submission
    const leadForm = await LeadForm.findOne({ submissions: id });

    if (!leadForm) {
      return res.status(404).json({ message: 'Associated form not found' });
    }

    // Remove the submission ID from the form's submissions array
    leadForm.submissions = leadForm.submissions.filter(
      (submissionId) => submissionId.toString() !== id,
    );
    await leadForm.save();

    // Delete the submission document
    await Submission.findByIdAndDelete(id);

    res.json({
      message: 'Submission deleted successfully',
      formTitle: leadForm.title,
    });
  } catch (error) {
    handleError(res, error);
  }
};

export default deleteWorkspaceSubmission;
