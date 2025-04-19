import LeadForm from '../../models/LeadForm.js';
import { handleError } from '../../utils/errorHandler.js';

// Publish a lead form
export const publishLeadForm = async (req, res) => {
  try {
    const leadForm = await LeadForm.findById(req.params.id);

    if (!leadForm) {
      return res.status(404).json({ message: 'Lead form not found' });
    }

    // Check if user has permission
    if (leadForm.createdBy.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to publish this form' });
    }

    // Generate shareable link if not already present
    if (!leadForm.shareableLink) {
      leadForm.shareableLink = `${process.env.FRONTEND_URL}/forms/${leadForm._id}`;
    }

    // Generate embed code
    leadForm.embedCode = `<iframe src="${process.env.FRONTEND_URL}/forms/embed/${leadForm._id}" width="100%" height="600px" frameborder="0"></iframe>`;

    leadForm.status = 'published';
    await leadForm.save();

    res.json(leadForm);
  } catch (error) {
    handleError(res, error);
  }
};
