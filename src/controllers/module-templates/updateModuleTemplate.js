import ModuleTemplate from '../../models/ModuleTemplate.js';
import ApiError from '../../utils/apiError.js';

/**
 * Update a module template by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const updateModuleTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace._id;
    const updateData = req.body;

    // Find the module template
    const moduleTemplate = await ModuleTemplate.findOne({
      _id: id,
      workspace: workspaceId,
    });

    if (!moduleTemplate) {
      throw new ApiError(404, 'Module template not found');
    }

    // Update the module template
    const updatedModuleTemplate = await ModuleTemplate.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    // Process the response to remove lookupFields from each field
    const processedTemplate = updatedModuleTemplate.toObject();
    if (processedTemplate.fields && processedTemplate.fields.length > 0) {
      processedTemplate.fields = processedTemplate.fields.map((field) => {
        const fieldObj = { ...field };
        delete fieldObj.lookupFields;
        return fieldObj;
      });
    }

    res.status(200).json({
      success: true,
      data: processedTemplate,
      message: 'Module template updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default updateModuleTemplate;
