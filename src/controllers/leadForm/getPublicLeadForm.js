import LeadForm from '../../models/LeadForm.js';
import { handleError } from '../../utils/errorHandler.js';

// Get a public lead form by ID
export const getPublicLeadForm = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the form that is published
    const leadForm = await LeadForm.findOne({
      _id: id,
    }).select('-submissions -notificationEmails -workspace -createdBy');

    if (!leadForm) {
      return res.status(404).json({ message: 'Form not found or not available' });
    }

    // Return the form data needed for public display
    res.status(200).json({
      status: 'success',
      data: {
        id: leadForm._id,
        title: leadForm.title,
        description: leadForm.description,
        elements: leadForm.elements,
        status: leadForm.status,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
