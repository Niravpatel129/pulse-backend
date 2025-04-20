import LeadForm from '../../models/LeadForm.js';
import { handleError } from '../../utils/errorHandler.js';
import { generateId } from '../../utils/helpers.js';

// Update a lead form
export const updateLeadForm = async (req, res) => {
  try {
    const leadForm = await LeadForm.findById(req.params.id);

    if (!leadForm) {
      return res.status(404).json({ message: 'Lead form not found' });
    }

    // Check if user has permission to update
    if (leadForm.createdBy.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this form' });
    }

    // Ensure IDs for new elements
    if (req.body.elements) {
      req.body.elements.forEach((element) => {
        if (!element.id) {
          element.id = generateId();
        }
      });
    }

    // Ensure IDs for new automations
    if (req.body.automations) {
      req.body.automations.forEach((automation) => {
        if (!automation.id) {
          automation.id = generateId();
        }
      });
    }

    Object.assign(leadForm, req.body);
    await leadForm.save();

    res.json(leadForm);
  } catch (error) {
    handleError(res, error);
  }
};
