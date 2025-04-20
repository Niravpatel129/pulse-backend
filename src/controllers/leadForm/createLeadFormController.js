import LeadForm from '../../models/LeadForm.js';
import { handleError } from '../../utils/errorHandler.js';
import { generateId } from '../../utils/helpers.js';

// Create a new lead form
export const createLeadForm = async (req, res) => {
  try {
    const workspace = req.workspace;

    // Ensure every element has an ID
    const elements = req.body.elements || [];
    elements.forEach((element) => {
      if (!element.id) {
        element.id = generateId();
      }
    });

    // Ensure every automation has an ID
    const automations = req.body.automations || [];
    automations.forEach((automation) => {
      if (!automation.id) {
        automation.id = generateId();
      }
    });

    const leadForm = new LeadForm({
      ...req.body,
      elements,
      automations,
      createdBy: req.user.userId,
      workspace: workspace._id,
      status: req.body.status || 'published',
    });

    await leadForm.save();
    res.status(201).json(leadForm);
  } catch (error) {
    handleError(res, error);
  }
};
