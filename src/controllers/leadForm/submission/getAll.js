import LeadForm from '../../../models/LeadForm.js';
import { handleError } from '../../../utils/errorHandler.js';

// Get all submissions for a form
export const getFormSubmissions = async (req, res) => {
  try {
    const { id } = req.params;

    const leadForm = await LeadForm.findById(id).populate('submissions.submittedBy', 'name email');

    if (!leadForm) {
      return res.status(404).json({ message: 'Lead form not found' });
    }

    // Check if user has permission to view submissions
    if (leadForm.createdBy.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to view submissions for this form' });
    }

    res.json(leadForm.submissions);
  } catch (error) {
    handleError(res, error);
  }
};
