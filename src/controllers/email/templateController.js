import EmailTemplate from '../../models/EmailTemplate.js';
import { handleError } from '../../utils/errorHandler.js';

export const getTemplates = async (req, res) => {
  try {
    const { projectId } = req.params;
    const templates = await EmailTemplate.find({ projectId })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');

    return res.status(200).json({
      success: true,
      templates,
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch email templates');
  }
};

export const saveTemplate = async (req, res) => {
  try {
    const { name, subject, body, projectId, variables } = req.body;
    const userId = req.user.userId;

    const template = await EmailTemplate.create({
      name,
      subject,
      body,
      projectId,
      variables,
      createdBy: userId,
    });

    return res.status(201).json({
      success: true,
      message: 'Template saved successfully',
      template,
    });
  } catch (error) {
    return handleError(res, error, 'Failed to save email template');
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.userId;

    const template = await EmailTemplate.findOneAndDelete({
      _id: templateId,
      createdBy: userId,
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found or unauthorized',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    return handleError(res, error, 'Failed to delete email template');
  }
};
