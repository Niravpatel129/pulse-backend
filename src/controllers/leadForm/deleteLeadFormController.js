import LeadForm from '../../models/LeadForm.js';
import { handleError } from '../../utils/errorHandler.js';

// Delete a lead form
export const deleteLeadForm = async (req, res) => {
  try {
    const leadForm = await LeadForm.findById(req.params.id);

    if (!leadForm) {
      return res.status(404).json({ message: 'Lead form not found' });
    }

    // Check if user has permission to delete
    if (leadForm.createdBy.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this form' });
    }

    await LeadForm.findByIdAndDelete(req.params.id);
    res.json({ message: 'Lead form deleted successfully' });
  } catch (error) {
    handleError(res, error);
  }
};
