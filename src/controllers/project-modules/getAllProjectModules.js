import ProjectModule from '../../models/ProjectModule.js';
import AppError from '../../utils/AppError.js';

const getAllProjectModules = async (req, res, next) => {
  try {
    const projectModules = await ProjectModule.find({ workspace: req.workspace._id })
      .populate('content.fileId')
      .populate('content.templateId')
      .populate('addedBy')
      .populate('project')
      .populate('versions.updatedBy')
      .populate('versions.contentSnapshot.fileId');

    res.status(200).json({
      status: 'success',
      results: projectModules.length,
      data: projectModules,
    });
  } catch (error) {
    next(new AppError(`Failed to fetch project modules: ${error.message}`, 400));
  }
};

export default getAllProjectModules;
