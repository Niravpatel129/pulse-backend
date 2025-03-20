import Email from '../../models/Email.js';
import { handleError } from '../../utils/errorHandler.js';

export const getEmailHistory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const emails = await Email.find({ projectId })
      .sort({ sentAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('sentBy', 'name email');

    const total = await Email.countDocuments({ projectId });

    return res.status(200).json({
      success: true,
      emails,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch email history');
  }
};

export const getEmailDetails = async (req, res) => {
  try {
    const { emailId } = req.params;
    const email = await Email.findById(emailId)
      .populate('sentBy', 'name email')
      .populate('projectId', 'name');

    if (!email) {
      return res.status(404).json({
        success: false,
        message: 'Email not found',
      });
    }

    return res.status(200).json({
      success: true,
      email,
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch email details');
  }
};
