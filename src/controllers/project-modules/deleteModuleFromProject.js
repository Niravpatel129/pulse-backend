import ProjectModule from '../../models/ProjectModule.js';
import AppError from '../../utils/AppError.js';

/**
 * Delete a module from a project
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const deleteModuleFromProject = async (req, res, next) => {
  try {
    const { moduleId } = req.params;

    // Find the module and check if it exists
    const module = await ProjectModule.findOne({
      _id: moduleId,
    });

    if (!module) {
      return next(new AppError('Module not found in this project', 404));
    }

    // Delete the module
    await ProjectModule.findByIdAndDelete(moduleId);

    res.status(200).json({
      status: 'success',
      message: 'Module successfully deleted from project',
    });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

export default deleteModuleFromProject;
