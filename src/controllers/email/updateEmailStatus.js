import ModuleEmail from '../../models/ModuleEmail.js';
import { handleError } from '../../utils/errorHandler.js';

export const updateEmailStatus = async (req, res) => {
  try {
    const { emailId } = req.params;
    const { status, approvalResponse } = req.body;

    const email = await ModuleEmail.findById(emailId);
    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email record not found',
      });
    }

    email.status = status;
    if (status === 'approved' || status === 'rejected') {
      email.approvedAt = new Date();
      email.approvalResponse = approvalResponse;
    }

    await email.save();

    return res.status(200).json({
      success: true,
      message: 'Email status updated successfully',
      email,
    });
  } catch (error) {
    return handleError(res, error, 'Failed to update email status');
  }
};
