import LeadForm from '../../models/LeadForm.js';
import { handleError } from '../../utils/errorHandler.js';

// Get a single lead form
export const getLeadForm = async (req, res) => {
  try {
    const leadForm = await LeadForm.findById(req.params.id).populate('createdBy', 'name email');

    if (!leadForm) {
      return res.status(404).json({ message: 'Lead form not found' });
    }

    res.json(leadForm);
  } catch (error) {
    handleError(res, error);
  }
};
