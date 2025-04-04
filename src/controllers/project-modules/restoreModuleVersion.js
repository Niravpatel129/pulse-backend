import ProjectModule from '../../models/ProjectModule.js';
import AppError from '../../utils/AppError.js';

const restoreModuleVersion = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { versionNumber } = req.body;

    const module = await ProjectModule.findById(moduleId);
    if (!module) {
      throw new AppError('Module not found', 404);
    }

    // Find the version to restore
    const versionToRestore = module.versions.find((v) => v.number === versionNumber);
    if (!versionToRestore) {
      throw new AppError('Version not found', 404);
    }

    // Simply update the currentVersion to the restored version number
    module.currentVersion = versionNumber;

    await module.save();

    res.status(200).json({
      status: 'success',
      data: module,
    });
  } catch (error) {
    next(error);
  }
};

export default restoreModuleVersion;
