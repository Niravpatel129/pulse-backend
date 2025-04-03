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

    res.status(200).json({
      success: true,
      data: moduleTemplates,
      message: 'Module templates retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default getModuleTemplates;
