import ProjectModule from '../../models/ProjectModule.js';
import AppError from '../../utils/AppError.js';

const updateModuleDetails = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { name, description, status, order } = req.body;

    const module = await ProjectModule.findById(moduleId);
    if (!module) {
      throw new AppError('Module not found', 404);
    }

    // Update only the fields that are provided
    if (name !== undefined) module.name = name;
    if (description !== undefined) module.description = description;
    if (status !== undefined) module.status = status;
    if (order !== undefined) module.order = order;

    await module.save();

    res.status(200).json({
      status: 'success',
      data: module,
    });
  } catch (error) {
    next(error);
  }
};

export default updateModuleDetails;
