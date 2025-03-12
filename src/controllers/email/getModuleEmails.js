import ModuleEmail from '../../models/ModuleEmail.js';
import { handleError } from '../../utils/errorHandler.js';

export const getModuleEmails = async (req, res) => {
  try {
    const { moduleId } = req.params;

    const emails = await ModuleEmail.find({ moduleId })
      .sort({ sentAt: -1 })
      .populate('sentBy', 'name email');

    return res.status(200).json({
      success: true,
      emails,
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch module emails');
  }
};
