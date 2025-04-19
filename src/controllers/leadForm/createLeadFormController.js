import LeadForm from '../../models/LeadForm.js';
import { handleError } from '../../utils/errorHandler.js';
import { generateId } from '../../utils/helpers.js';

// Create a new lead form
export const createLeadForm = async (req, res) => {
  try {
    const workspace = req.workspace;

    // Ensure every form element has an ID
    const formElements = req.body.formElements || [];
    formElements.forEach((element) => {
      if (!element.id) {
        element.id = generateId();
      }
    });

    const leadForm = new LeadForm({
      ...req.body,
      formElements,
      createdBy: req.user.userId,
      workspace: workspace._id,
      status: 'published',
    });

    await leadForm.save();
    res.status(201).json(leadForm);
  } catch (error) {
    handleError(res, error);
  }
};
