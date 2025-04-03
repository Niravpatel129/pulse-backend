import ModuleTemplate from '../../models/ModuleTemplate.js';

/**
 * Get all module templates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getModuleTemplates = async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;

    // Find all module templates for the current workspace
    const moduleTemplates = await ModuleTemplate.find({
      workspace: workspaceId,
    });

    // Remove lookupFields from each field in each module template
    const processedModuleTemplates = moduleTemplates.map((template) => {
      const templateObj = template.toObject();
      if (templateObj.fields && templateObj.fields.length > 0) {
        templateObj.fields = templateObj.fields.map((field) => {
          const fieldObj = { ...field };
          delete fieldObj.lookupFields;
          return fieldObj;
        });
      }
      return templateObj;
    });

    res.status(200).json({
      success: true,
      data: processedModuleTemplates,
      message: 'Module templates retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default getModuleTemplates;
