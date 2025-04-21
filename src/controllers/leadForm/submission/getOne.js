import LeadForm from '../../../models/LeadForm.js';
import Submission from '../../../models/LeadForm/SubmissionSchema.js';
import { handleError } from '../../../utils/errorHandler.js';

// Get a specific submission
export const getSubmission = async (req, res) => {
  try {
    const { formId, submissionId } = req.params;

    // Find the lead form
    const leadForm = await LeadForm.findById(formId);

    if (!leadForm) {
      return res.status(404).json({ message: 'Lead form not found' });
    }

    // Check if user has permission to view submissions
    if (leadForm.createdBy.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to view submissions for this form' });
    }

    // Check if the submission ID is in the form's submissions array
    if (!leadForm.submissions.includes(submissionId)) {
      return res.status(404).json({ message: 'Submission not found for this form' });
    }

    // Find the submission by ID and populate the submittedBy field
    const submission = await Submission.findById(submissionId).populate(
      'submittedBy',
      'name email',
    );

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.json(submission);
  } catch (error) {
    handleError(res, error);
  }
};
