import ModuleTemplate from '../../models/ModuleTemplate.js';
import ApiError from '../../utils/apiError.js';

/**
 * Delete a module template by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const deleteModuleTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace._id;

    // Find the module template
    const moduleTemplate = await ModuleTemplate.findOne({
      _id: id,
      workspace: workspaceId,
    });

    if (!moduleTemplate) {
      throw new ApiError(404, 'Module template not found');
    }

    await ModuleTemplate.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      data: null,
      message: 'Module template deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default deleteModuleTemplate;
