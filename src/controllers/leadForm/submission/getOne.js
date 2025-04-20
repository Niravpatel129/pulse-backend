import LeadForm from '../../../models/LeadForm.js';
import { handleError } from '../../../utils/errorHandler.js';

// Get a specific submission
export const getSubmission = async (req, res) => {
  try {
    const { formId, submissionId } = req.params;

    const leadForm = await LeadForm.findById(formId).populate(
      'submissions.submittedBy',
      'name email',
    );

    if (!leadForm) {
      return res.status(404).json({ message: 'Lead form not found' });
    }

    // Check if user has permission to view submissions
    if (leadForm.createdBy.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to view submissions for this form' });
    }

    const submission = leadForm.submissions.id(submissionId);

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.json(submission);
  } catch (error) {
    handleError(res, error);
  }
};
