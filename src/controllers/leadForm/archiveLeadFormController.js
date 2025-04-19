import LeadForm from '../../models/LeadForm.js';
import { handleError } from '../../utils/errorHandler.js';

// Archive a lead form
export const archiveLeadForm = async (req, res) => {
  try {
    const leadForm = await LeadForm.findById(req.params.id);

    if (!leadForm) {
      return res.status(404).json({ message: 'Lead form not found' });
    }

    // Check if user has permission
    if (leadForm.createdBy.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to archive this form' });
    }

    leadForm.status = 'archived';
    await leadForm.save();

    res.json(leadForm);
  } catch (error) {
    handleError(res, error);
  }
};
