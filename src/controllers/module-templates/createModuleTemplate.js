import ModuleTemplate from '../../models/ModuleTemplate.js';
import AppError from '../../utils/AppError.js';

/**
 * Create a new module template
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const createModuleTemplate = async (req, res, next) => {
  try {
    const { name, description, fields } = req.body;
    const workspaceId = req.workspace._id;
    const userId = req.user.userId;

    if (!name) {
      return next(new AppError('Template name is required', 400));
    }

    // Process fields to ensure they have the correct structure
    const processedFields =
      fields?.map((field) => {
        const processedField = {
          name: field.name,
          type: field.type,
          description: field.description,
          required: field.required || false,
          options: field.options || [],
        };

        // Handle relation type fields
        if (field.type === 'relation' && field.relationType) {
          processedField.relationType = field.relationType;
          processedField.multiple = field.multiple || false;
          processedField.lookupFields = field.lookupFields || [];
        }

        return processedField;
      }) || [];

    const moduleTemplate = await ModuleTemplate.create({
      name,
      description,
      fields: processedFields,
      workspace: workspaceId,
      createdBy: userId,
    });

    res.status(201).json({
      success: true,
      data: moduleTemplate,
      message: 'Module template created successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default createModuleTemplate;
