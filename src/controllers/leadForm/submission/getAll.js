import LeadForm from '../../../models/LeadForm.js';
import Submission from '../../../models/LeadForm/SubmissionSchema.js';
import { handleError } from '../../../utils/errorHandler.js';

// Get all submissions for a form
export const getFormSubmissions = async (req, res) => {
  try {
    const { id } = req.params;

    const leadForm = await LeadForm.findById(id);

    if (!leadForm) {
      return res.status(404).json({ message: 'Lead form not found' });
    }

    // Check if user has permission to view submissions
    if (leadForm.createdBy.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to view submissions for this form' });
    }

    // Get all submissions referenced by this form
    const submissions = await Submission.find({
      _id: { $in: leadForm.submissions },
    }).populate('submittedBy', 'name email');

    res.json(submissions);
  } catch (error) {
    handleError(res, error);
  }
};
